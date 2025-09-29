"use client"

import * as React from "react"
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { PieChart as PieChartIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { useCategories } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { getCategoryColor } from "@/lib/categories"

type Item = {
  name: string
  amount: number
  percent: number
  fill: string
}

// Use canonical category colors from lib/categories.ts

export function ExpenseChart() {
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { data: categoriesData, isLoading, error } = useCategories(dateRangeForAPI)

  const currency = baseCurrency
  const currencySymbol = getCurrencySymbol(currency)

  const chartData: Item[] = React.useMemo(() => {
    if (!categoriesData || categoriesData.length === 0) return []

    const TOP_N = 8
    // Convert each category amount from assumed EUR to baseCurrency
    const converted = categoriesData.map((c: any) => ({
      name: c.name,
      amount: convertAmount(c.amount || 0, 'EUR', baseCurrency),
      percent: c.percent,
    }))

    const totalAll = converted.reduce((a, c: any) => a + (c.amount || 0), 0)
    const top = converted.slice(0, TOP_N).map((c: any) => ({
      name: c.name,
      amount: c.amount,
      percent: c.percent,
      fill: getCategoryColor(c.name)
    }))
    const othersAmount = converted.slice(TOP_N).reduce((a: number, c: any) => a + (c.amount || 0), 0)
    if (othersAmount > 0) {
      top.push({
        name: "Other",
        amount: Number(othersAmount.toFixed(2)),
        percent: totalAll > 0 ? Number(((othersAmount / totalAll) * 100).toFixed(2)) : 0,
        fill: getCategoryColor('Uncategorized')
      })
    }
    return top
  }, [categoriesData, baseCurrency, convertAmount])

  const total = React.useMemo(() => {
    // Sum all categories (server already returns full range totals)
    return chartData.reduce((a, c) => a + c.amount, 0)
  }, [chartData])

  // Which slice is emphasized (hover) or locked (click)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const [lockedIndex, setLockedIndex] = React.useState<number | null>(null)

  const currentIndex = lockedIndex ?? activeIndex
  const current = typeof currentIndex === "number" ? chartData[currentIndex] : undefined

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload?.length) {
      const d: Item = payload[0].payload
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: d.fill }}
            />
            <p className="text-sm font-medium text-popover-foreground">{d.name}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {currencySymbol}{d.amount.toLocaleString()} • {d.percent.toFixed(1)}%
          </p>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col flex-1 p-6 overflow-hidden">
          <div className="relative flex-1 flex items-center justify-center min-h-[280px] mt-0">
            <Skeleton className="aspect-square h-[240px] w-[240px] rounded-full" />
          </div>
          <div className="mt-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !categoriesData) {
    return (
      <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 flex-1">
          <PieChartIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            Unable to load breakdown
          </p>
          <p className="text-xs text-muted-foreground/70 text-center mt-1">
            Please try refreshing
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!total || chartData.length === 0) {
    return (
      <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Breakdown</CardTitle>
          <PieChartIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 flex-1">
          <PieChartIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            No expenses yet
          </p>
          <p className="text-xs text-muted-foreground/70 text-center mt-1">
            Start tracking to see your breakdown
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Breakdown</CardTitle>
        <PieChartIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      <CardContent className="flex flex-col flex-1 pb-4 overflow-hidden">
        {/* Donut */}
        <div className="relative flex-1 flex items-center justify-center min-h-[280px] mt-0 mb-2">
          <ChartContainer
            config={{}}
            className="mx-auto aspect-square h-[280px] w-[360px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* <ChartTooltip cursor={false} content={<CustomTooltip />} /> */}
                <defs>
                  {chartData.map((entry, idx) => (
                    <filter key={`shadow-${idx}`} id={`shadow-${idx}`}>
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                    </filter>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={75}
                  outerRadius={120}
                  strokeWidth={0}
                  onMouseLeave={() => setActiveIndex(null)}
                  onMouseEnter={(_, idx) => lockedIndex == null && setActiveIndex(idx)}
                  onClick={(_, idx) => setLockedIndex(lockedIndex === idx ? null : idx)}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {chartData.map((entry, idx) => {
                    const isActive = currentIndex === idx
                    return (
                      <Cell
                        key={entry.name}
                        fill={entry.fill}
                        className={cn(
                          "glass transition-all duration-200 cursor-pointer",
                          isActive ? "opacity-100" : "opacity-95 hover:opacity-90"
                        )}
                        style={{
                          filter: isActive ? `url(#shadow-${idx})` : 'none',
                          transform: isActive ? 'scale(1.05)' : 'scale(1)',
                          transformOrigin: 'center'
                        }}
                      />
                    )
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Center stat */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {current ? (
                <>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {current.name}
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {currencySymbol}{Math.round(current.amount).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground/80 mt-0.5">
                    {current.percent.toFixed(1)}% of total
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Total Expenses
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {currencySymbol}{Math.round(total).toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground/80 mt-0.5">
                    {chartData.length} categories
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {chartData
            .filter((_, idx) => idx < 6) // Only show top 6 categories
            .map((item, idx) => (
            <button
              key={item.name}
              onClick={() => setLockedIndex(lockedIndex === idx ? null : idx)}
              onMouseEnter={() => lockedIndex == null && setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-left",
                "hover:bg-muted/50",
                currentIndex === idx && "bg-muted/60"
              )}
              style={{
                animation: `fadeIn 0.5s ease-out ${idx * 0.05}s backwards`
              }}
            >
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0 transition-transform"
                style={{ 
                  backgroundColor: item.fill,
                  transform: currentIndex === idx ? 'scale(1.25)' : 'scale(1)'
                }}
              />
              <span className="text-xs font-medium text-muted-foreground truncate flex-1">
                {item.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground/70">
                {item.percent.toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </CardContent>
      
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  )
}