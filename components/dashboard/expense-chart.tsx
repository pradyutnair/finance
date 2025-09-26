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
import { Progress } from "@/components/ui/progress"
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart"

type Item = {
  category: "food" | "grocery" | "shopping" | "transport"
  amount: number
  percentage: number
  fill: string
}

const chartData: Item[] = [
  { category: "food",      amount: 540, percentage: 48, fill: "hsl(0 0% 20%)" },
  { category: "grocery",   amount: 360, percentage: 32, fill: "hsl(0 0% 45%)" },
  { category: "shopping",  amount: 146, percentage: 13, fill: "hsl(0 0% 25%)" },
  { category: "transport", amount: 79,  percentage: 7,  fill: "hsl(0 0% 65%)" },
]

const chartConfig = {
  amount: { label: "Amount" },
  food:      { label: "Food & Drink", color: "hsl(0 0% 20%)" },
  grocery:   { label: "Grocery",      color: "hsl(0 0% 45%)" },
  shopping:  { label: "Shopping",     color: "hsl(0 0% 25%)" },
  transport: { label: "Transport",    color: "hsl(0 0% 65%)" },
} satisfies ChartConfig

export function ExpenseChart() {
  const total = React.useMemo(
    () => chartData.reduce((a, c) => a + c.amount, 0),
    []
  )

  // Which slice is emphasized (hover) or locked (click)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)
  const [lockedIndex, setLockedIndex] = React.useState<number | null>(null)

  const currentIndex = lockedIndex ?? activeIndex
  const current = typeof currentIndex === "number" ? chartData[currentIndex] : undefined
  const label = current
    ? chartConfig[current.category].label
    : "Total"

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d: Item = payload[0].payload
      const label = chartConfig[d.category].label
      const pct = ((d.amount / total) * 100).toFixed(1)
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-popover-foreground font-medium">{label}</p>
          <p className="text-muted-foreground">
            ${d.amount.toLocaleString()} • {pct}%
          </p>
        </div>
      )
    }
    return null
  }

  if (!total) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
          <CardDescription>No expenses for this period.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Summary</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Data from 1-12 Apr, 2024
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 p-6">
        {/* Donut */}
        <div className="relative flex-1 flex items-center justify-center">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[260px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="category"
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
                        key={entry.category}
                        fill={entry.fill}
                        className={cn(
                          "transition-all cursor-pointer",
                          isActive ? "opacity-100" : "opacity-85 hover:opacity-95"
                        )}
                        // enlarge active slice subtly
                        outerRadius={isActive ? 125 : 120}
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
                  ? `$${current.amount.toLocaleString()}`
                  : `$${total.toLocaleString()}`}
              </div>
              {current && (
                <div className="text-xs text-muted-foreground">
                  {((current.amount / total) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}