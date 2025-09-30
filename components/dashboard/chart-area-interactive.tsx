"use client"

import * as React from "react"
import { Bar, Line, ComposedChart, Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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

type Metric = "expenses" | "income" | "savings"

type TimeseriesPoint = {
  date: string
  expenses?: number | null
  income?: number | null
}

type ChartDatum = {
  date: string
  value: number
  cumulative: number
}

function getAllDates(start: Date, end: Date): Date[] {
  const dateArray = [];
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (current <= stop) {
    dateArray.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dateArray;
}

//

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [metric, setMetric] = React.useState<Metric>("expenses")
  const { useTimeseries } = require("@/lib/api")
  const { useDateRange } = require("@/contexts/date-range-context")
  const { useCurrency } = require("@/contexts/currency-context")
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount } = useCurrency()
  const dateRangeForAPI = dateRange?.from && dateRange?.to
    ? { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    : undefined
  const { data } = useTimeseries(dateRangeForAPI)
  const current = React.useMemo<ChartDatum[]>(() => {
    if (!dateRange?.from || !dateRange?.to) return []

    const from = new Date(dateRange.from)
    from.setHours(0, 0, 0, 0)
    const to = new Date(dateRange.to)
    to.setHours(23, 59, 59, 999)

    const dataMap = new Map<number, { expenses: number; income: number }>()
    data?.forEach((d: TimeseriesPoint) => {
      const dt = new Date(d.date)
      dt.setHours(0, 0, 0, 0)
      const key = dt.getTime()
      dataMap.set(key, {
        expenses: convertAmount(d.expenses || 0, 'EUR', baseCurrency),
        income: convertAmount(d.income || 0, 'EUR', baseCurrency),
      })
    })

    const getValueForDate = (dt: Date, m: Metric): number => {
      const key = dt.getTime()
      const entry = dataMap.get(key) || { expenses: 0, income: 0 }
      if (m === 'expenses') return entry.expenses
      if (m === 'income') return entry.income
      return entry.income - entry.expenses
    }

    const chartDates = getAllDates(from, to)
    const chartData: ChartDatum[] = chartDates.map((dt) => ({
      date: dt.toISOString(),
      value: getValueForDate(dt, metric),
      cumulative: 0,
    }))

    let cumulativeTotal = 0
    chartData.forEach((d) => {
      cumulativeTotal += d.value
      d.cumulative = cumulativeTotal
    })

    return chartData
  }, [data, metric, baseCurrency, convertAmount, dateRange])

  const nf = React.useMemo(() => {
    const currency = baseCurrency || "EUR"
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })
  }, [baseCurrency])
  
  const hasCumulative = React.useMemo(() => current.length >= 2, [current])

  const renderChart = () => {
    return (
      <ComposedChart accessibilityLayer data={current} margin={{ left: 12, right: 12 }}>
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
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => nf.format(value)}
        />
        {hasCumulative && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => nf.format(value)}
          />
        )}
        <ChartTooltip
          cursor={false}
          content={({ label, payload }) => {
            if (!payload?.length) return null

            const row = payload[0].payload
            const dailyV = row.value as number
            const cumV = row.cumulative as number

            const formattedDaily = nf.format(dailyV)
            const formattedCum = nf.format(cumV)

            const formattedDate = new Date(label).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })

            return (
              <div className="rounded-lg bg-popover p-2 shadow-md">
                <div className="font-bold text-xl text-foreground whitespace-pre-wrap">
                  {hasCumulative ? `Daily: ${formattedDaily}\nCumulative: ${formattedCum}` : formattedDaily}
                </div>
                <div className="text-xs text-muted-foreground">{formattedDate}</div>
              </div>
            )
          }}
        />
        <Bar dataKey="value" fill="var(--chart-1)" radius={0} yAxisId="left" />
        {hasCumulative && (
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            yAxisId="right"
          />
        )}
      </ComposedChart>
    )
  }

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
          {renderChart()}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}