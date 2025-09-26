"use client"

import * as React from "react"
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

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

type Item = {
  name: string
  amount: number
  percent: number
  fill: string
}

const categoryColors = [
  "hsl(0 0% 20%)",
  "hsl(0 0% 45%)", 
  "hsl(0 0% 25%)",
  "hsl(0 0% 65%)",
  "hsl(0 0% 35%)",
  "hsl(0 0% 55%)",
  "hsl(0 0% 15%)",
  "hsl(0 0% 75%)",
]

export function ExpenseChart() {
  const { dateRange, formatDateForAPI } = useDateRange()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { data: categoriesData, isLoading, error } = useCategories(dateRangeForAPI)

  const chartData: Item[] = React.useMemo(() => {
    if (!categoriesData || categoriesData.length === 0) return []
    
    return categoriesData.slice(0, 8).map((category: any, index: number) => ({
      name: category.name,
      amount: category.amount,
      percent: category.percent,
      fill: categoryColors[index % categoryColors.length]
    }))
  }, [categoriesData])

  const total = React.useMemo(
    () => chartData.reduce((a, c) => a + c.amount, 0),
    [chartData]
  )

  // Which slice is emphasized (hover) or locked (click)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const [lockedIndex, setLockedIndex] = React.useState<number | null>(null)

  const currentIndex = lockedIndex ?? activeIndex
  const current = typeof currentIndex === "number" ? chartData[currentIndex] : undefined
  const label = current ? current.name : "Total"

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload?.length) {
      const d: Item = payload[0].payload
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-popover-foreground font-medium">{d.name}</p>
          <p className="text-muted-foreground">
            €{d.amount.toLocaleString()} • {d.percent.toFixed(1)}%
          </p>
        </div>
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 p-6">
          <div className="relative flex-1 flex items-center justify-center">
            <Skeleton className="aspect-square max-h-[260px] w-full rounded-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !categoriesData) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Failed to load expense breakdown. Please try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!total || chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No expenses for this period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Breakdown</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 p-6">
        {/* Donut */}
        <div className="relative flex-1 flex items-center justify-center">
          <ChartContainer
            config={{}}
            className="mx-auto aspect-square max-h-[260px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={80}
                  outerRadius={120}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                  onMouseLeave={() => setActiveIndex(null)}
                  onMouseEnter={(_, idx) => lockedIndex == null && setActiveIndex(idx)}
                  onClick={(_, idx) => setLockedIndex(lockedIndex === idx ? null : idx)}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, idx) => {
                    const isActive = currentIndex === idx
                    return (
                      <Cell
                        key={entry.name}
                        fill={entry.fill}
                        className={cn(
                          "transition-all cursor-pointer",
                          isActive ? "opacity-100" : "opacity-85 hover:opacity-95"
                        )}
                        // enlarge active slice subtly
                        {...(isActive ? { style: { transform: 'scale(1.04)' } } : {})}
                      />
                    )
                  })}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Center stat */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center leading-tight">
              <div className="text-xs text-muted-foreground">
                {label}
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {current
                  ? `€${current.amount.toLocaleString()}`
                  : `€${total.toLocaleString()}`}
              </div>
              {current && (
                <div className="text-xs text-muted-foreground">
                  {current.percent.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}