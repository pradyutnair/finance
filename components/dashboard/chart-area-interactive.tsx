"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Expenses / Income / Savings"

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [metric, setMetric] = React.useState<"expenses" | "income" | "savings">("expenses")
  const { useTimeseries } = require("@/lib/api")
  const { useDateRange } = require("@/contexts/date-range-context")
  const { useCurrency } = require("@/contexts/currency-context")
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount } = useCurrency()
  const dateRangeForAPI = dateRange?.from && dateRange?.to
    ? { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    : undefined
  const { data } = useTimeseries(dateRangeForAPI)
  const current = React.useMemo(() => {
    const arr = (data || []).map((d: any) => {
      const date = new Date(d.date).toISOString()
      const expenses = convertAmount(d.expenses || 0, 'EUR', baseCurrency)
      const income = convertAmount(d.income || 0, 'EUR', baseCurrency)
      if (metric === "expenses") return { date, value: expenses }
      if (metric === "income") return { date, value: income }
      const net = income - expenses
      const pct = income > 0 ? (net / income) * 100 : 0
      return { date, value: Number(pct.toFixed(2)) }
    })
    return arr
  }, [data, metric, baseCurrency, convertAmount])

  const nf = React.useMemo(() => {
    const currency = baseCurrency || "EUR"
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })
  }, [baseCurrency])
  
  const valueFormatter = (v: number) =>
    metric === "savings" ? `${v.toFixed(1)}%` : nf.format(v)
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total {metric.charAt(0).toUpperCase() + metric.slice(1)}</CardTitle>
        <CardAction>
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(v) => v && setMetric(v as any)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="expenses">Expenses</ToggleGroupItem>
            <ToggleGroupItem value="income">Income</ToggleGroupItem>
            <ToggleGroupItem value="savings">Savings</ToggleGroupItem>
          </ToggleGroup>
          <Select value={metric} onValueChange={(v) => setMetric(v as any)}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Expenses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="expenses" className="rounded-lg">Expenses</SelectItem>
              <SelectItem value="income" className="rounded-lg">Income</SelectItem>
              <SelectItem value="savings" className="rounded-lg">Savings</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={{}} className="aspect-auto h-[250px] w-full">
          <BarChart accessibilityLayer data={current} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                if (metric === "savings") {
                  return `${value}%`
                }
                return nf.format(value)
              }}
            />
            <ChartTooltip
              content={({ label, payload }) => {
                if (!payload?.length) return null

                const v = payload[0].value as number
                const currency = baseCurrency || "EUR"
                const nf = new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency,
                  maximumFractionDigits: 0,
                })

                const formattedValue = metric === "savings" ? `${v.toFixed(1)}%` : nf.format(v)

                const formattedDate = new Date(label).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })

                return (
                  <div className="rounded-lg bg-popover p-2 shadow-md">
                    <div className="font-bold text-2xl text-foreground">
                      {formattedValue}
                    </div>
                    <div className="text-xs text-muted-foreground">{formattedDate}</div>
                  </div>
                )
              }}
            />

            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={0}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
