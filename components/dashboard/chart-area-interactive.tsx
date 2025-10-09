"use client"

import * as React from "react"
import { Bar, BarChart, Line, LineChart, ComposedChart, CartesianGrid, XAxis, YAxis, Scatter, Area, AreaChart } from "recharts"

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
  isProjected: boolean
  cumulative: number
  actualCum?: number | null
  projectedCum?: number | null
  isLast?: boolean
}

function getAllDates(start: Date, end: Date): Date[] {
  const dateArray = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (current <= stop) {
    dateArray.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dateArray;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  d.setHours(0, 0, 0, 0)
  return d
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [metric, setMetric] = React.useState<Metric>("expenses")
  const { useDateRange, useCurrency, useMetrics } = require("@/lib/stores")
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount } = useCurrency()
  const { timeseries: data, fetchTimeseries } = useMetrics()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to
    ? { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    : undefined
  
  // Fetch timeseries when date range changes
  React.useEffect(() => {
    fetchTimeseries(dateRangeForAPI)
  }, [dateRangeForAPI?.from, dateRangeForAPI?.to, fetchTimeseries])
  const current = React.useMemo<ChartDatum[]>(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dataMap = new Map<number, { expenses: number; income: number }>();
    data?.forEach((d: TimeseriesPoint) => {
      // Parse date correctly - API returns YYYY-MM-DD strings
      // Create date at midnight local time to match our from/to/today
      const [year, month, day] = d.date.split('-').map(Number);
      const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
      const key = dt.getTime();
      dataMap.set(key, {
        expenses: convertAmount(d.expenses || 0, 'EUR', baseCurrency),
        income: convertAmount(d.income || 0, 'EUR', baseCurrency),
      });
    });

    console.log("Data Map:", dataMap);

    const getValueForDate = (dt: Date, metric: Metric): number => {
      const key = dt.getTime();
      const entry = dataMap.get(key) || { expenses: 0, income: 0 };
      if (metric === 'expenses') return entry.expenses;
      if (metric === 'income') return entry.income;
      return entry.income - entry.expenses;
    };

    // Build data for every day in the selected range.
    // Future days are included with a value of 0 so the X axis shows them.
    const chartDates = getAllDates(from, to);
    const chartData: ChartDatum[] = chartDates.map((dt) => {
      const isProjected = dt > today;
      const value = isProjected ? 0 : getValueForDate(dt, metric);
      // Format date as YYYY-MM-DD for consistent display (avoid timezone issues)
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return {
        date: dateStr,
        value,
        isProjected,
        cumulative: 0,
      };
    });

    // Calculate run rate once for projected dates (if needed)
    let runRate = 0;
    if ((metric === 'expenses' || metric === 'savings') && chartData.some(d => d.isProjected)) {
      const elapsedEnd = new Date(Math.min(today.getTime(), to.getTime()));
      const elapsedDates = getAllDates(from, elapsedEnd);
      const D_elapsed = elapsedDates.length;
      let S_actual = 0;
      elapsedDates.forEach((dt) => {
        S_actual += getValueForDate(dt, metric);
      });
      runRate = D_elapsed >= 3 ? S_actual / D_elapsed : 0;
    }

    // Calculate cumulative values
    let cum = 0;
    chartData.forEach((d) => {
      // For future dates, use the run rate to project cumulative
      // Keep bar values at zero for future dates
      if (d.isProjected && (metric === 'expenses' || metric === 'savings')) {
        cum += runRate;
      } else {
        cum += d.value;
      }
      d.cumulative = cum;
    });

    // For expenses and savings, split cumulative into actual and projected lines
    if (metric === 'expenses' || metric === 'savings') {
      const hasProjected = chartData.some(d => d.isProjected);
      const lastActualIndex = chartData.findLastIndex((d) => !d.isProjected);
      
      if (lastActualIndex >= 0) {
        chartData.forEach((d, i) => {
          if (hasProjected) {
            // When there are projected dates, split the lines
            d.actualCum = i <= lastActualIndex ? d.cumulative : null;
            // Projected line starts from the last actual point to ensure continuity
            d.projectedCum = i >= lastActualIndex ? d.cumulative : null;
          } else {
            // When all dates are actual (no future dates), only show actualCum
            d.actualCum = d.cumulative;
            d.projectedCum = null;
          }
        });
      } else {
        // No actual data, all projected
        chartData.forEach((d) => {
          d.actualCum = null;
          d.projectedCum = d.cumulative;
        });
      }
    }

    if (chartData.length > 0) chartData[chartData.length - 1].isLast = true;

    return chartData;
  }, [data, metric, baseCurrency, convertAmount, dateRange])

  const nf = React.useMemo(() => {
    const currency = baseCurrency || "EUR"
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })
  }, [baseCurrency])
  
  const valueFormatter = (v: number) =>
    metric === "savings" ? nf.format(v) : nf.format(v)

  const projectedEomExpenses = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null

    const from = new Date(dateRange.from)
    from.setHours(0, 0, 0, 0)
    const to = new Date(dateRange.to)
    to.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Use the selected date range for projection calculation
    const elapsedEnd = today;
    const start = from;

    const dataMap = new Map<number, { expenses: number; income: number }>()
    data?.forEach((d: TimeseriesPoint) => {
      // Parse date correctly - API returns YYYY-MM-DD strings
      const [year, month, day] = d.date.split('-').map(Number);
      const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
      const key = dt.getTime()
      dataMap.set(key, {
        expenses: convertAmount(d.expenses || 0, 'EUR', baseCurrency),
        income: convertAmount(d.income || 0, 'EUR', baseCurrency),
      })
    })

    const elapsedDates = getAllDates(start, elapsedEnd)
    const daysElapsed = elapsedDates.length
    let actualMtd = 0
    elapsedDates.forEach((dt) => {
      const key = dt.getTime()
      const entry = dataMap.get(key) || { expenses: 0, income: 0 }
      actualMtd += entry.expenses
    })

    // Expenses are negative, so use absolute value for projection
    const actualAbsolute = Math.abs(actualMtd)

    // Calculate remaining days in selected date range
    const nextDay = new Date(elapsedEnd)
    nextDay.setDate(nextDay.getDate() + 1)
    const remainingDates = nextDay <= to ? getAllDates(nextDay, to) : []
    const remainingDays = remainingDates.length

    if (remainingDays <= 0) return actualAbsolute

    // Calculate burn rate (daily average) and project to end of selected range
    const burnRate = daysElapsed > 0 ? actualAbsolute / daysElapsed : 0
    const projectedEom = actualAbsolute + (burnRate * remainingDays)
    
    return projectedEom
  }, [data, dateRange, baseCurrency, convertAmount])

  const renderChart = () => {
    if (metric === "savings") {
      return (
        <AreaChart accessibilityLayer data={current} margin={{ left: 12, right: 12 }}>
          <defs>
            <linearGradient id="fillSavings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
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
          <ChartTooltip
            cursor={false}
            content={({ label, payload }) => {
              if (!payload?.length) return null

              const v = payload[0].value as number
              const formattedValue = nf.format(v)

              const formattedDate = new Date(label).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })

              return (
              <div className="rounded-lg bg-popover p-2 shadow-md">
                <div className="font-bold text-xl text-foreground">
                  {formattedValue}
                </div>
                <div className="text-xs text-muted-foreground">{formattedDate}</div>
              </div>
              )
            }}
          />
          <Area
            dataKey="cumulative"
            type="natural"
            fill="url(#fillSavings)"
            stroke="var(--chart-1)"
            strokeWidth={2}
          />
        </AreaChart>
      )
    }

    if (metric === "expenses") {
      // Use simple bar chart like income - test if ComposedChart is the issue
      const allValues = current.map(d => d.value).filter(v => !isNaN(v) && v !== null)
      const minValue = allValues.length > 0 ? Math.min(...allValues) : 0
      const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0
      const range = maxValue - minValue
      const padding = Math.max(50, range * 0.1)
      const domain = [Math.max(0, minValue - padding), maxValue + padding]
      
      return (
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
            domain={domain}
            tickFormatter={(value) => nf.format(value)}
          />
          <ChartTooltip
            cursor={false}
            content={({ label, payload }) => {
              if (!payload?.length) return null

              const data = payload[0].payload
              const dailyV = data.value as number
              const cumV = data.cumulative as number
              const isProjected = data.isProjected

              const formattedDaily = nf.format(dailyV)
              const formattedCum = nf.format(cumV)
              const tooltipContent = isProjected 
                ? `Projected Total: ${formattedCum}`
                : `Daily: ${formattedDaily}\nCumulative: ${formattedCum}`

              const formattedDate = new Date(label).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })

              return (
                <div className="rounded-lg bg-popover p-2 shadow-md">
                  <div className="font-bold text-xl text-foreground whitespace-pre-wrap">
                    {tooltipContent}
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
      )
    }

    // Income - standard bar chart
    const allValues = current.map(d => d.value).filter(v => !isNaN(v) && v !== null)
    const minValue = allValues.length > 0 ? Math.min(...allValues) : 0
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0
    const range = maxValue - minValue
    const padding = Math.max(50, range * 0.1)
    const domain = [Math.max(0, minValue - padding), maxValue + padding]
    
    return (
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
          domain={domain}
          tickFormatter={(value) => nf.format(value)}
        />
        <ChartTooltip
          cursor={false}
          content={({ label, payload }) => {
            if (!payload?.length) return null

            const v = payload[0].value as number
            const formattedValue = nf.format(v)

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
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total {metric.charAt(0).toUpperCase() + metric.slice(1)}</CardTitle>
        {metric === 'expenses' && projectedEomExpenses != null && (
          <CardDescription className="mt-1 relative group cursor-pointer">
            Projected: {nf.format(projectedEomExpenses as number)}
            <span className="ml-1 align-middle">
              <svg
                className="inline h-3 w-3 ml-2 mb-1 text-muted-foreground group-hover:text-foreground transition-colors"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <text x="10" y="15" textAnchor="middle" fontSize="12" fill="currentColor">i</text>
              </svg>
            </span>
            <div className="absolute left-0 mt-2 z-10 hidden w-72 rounded-lg bg-popover p-3 text-xs text-muted-foreground shadow-lg group-hover:block">
              Projected = Current total + (Daily burn rate × Remaining days).<br />
              Daily burn rate = Total so far ÷ Days elapsed.<br />
              This estimates your expenses for the selected date range if you continue spending at the current daily average.
            </div>
          </CardDescription>
        )}
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