"use client"

import * as React from "react"
import { Bar, BarChart, Line, LineChart, ComposedChart, CartesianGrid, XAxis, YAxis, Scatter, Area, AreaChart } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { useTimeseries } from "@/lib/api"
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
  const { useDateRange } = require("@/contexts/date-range-context")
  const { useCurrency } = require("@/contexts/currency-context")
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount } = useCurrency()
  const dateRangeForAPI = dateRange?.from && dateRange?.to
    ? { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    : undefined
  const { data } = useTimeseries(dateRangeForAPI)
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
      const dt = new Date(d.date);
      dt.setHours(0, 0, 0, 0);
      const key = dt.getTime();
      dataMap.set(key, {
        expenses: convertAmount(d.expenses || 0, 'EUR', baseCurrency),
        income: convertAmount(d.income || 0, 'EUR', baseCurrency),
      });
    });

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
      return {
        date: dt.toISOString(),
        value,
        isProjected,
        cumulative: 0,
      };
    });


    let cum = 0;
    let actualSum = 0;
    chartData.forEach((d) => {
      // For future dates, optionally show a projected cumulative using
      // the last observed daily average. Keep bars at zero.
      if (d.isProjected && (metric === 'expenses' || metric === 'savings')) {
        const elapsedEnd = new Date(Math.min(today.getTime(), to.getTime()));
        const elapsedDates = getAllDates(from, elapsedEnd);
        const D_elapsed = elapsedDates.length;
        let S_actual = 0;
        elapsedDates.forEach((dt) => {
          S_actual += getValueForDate(dt, metric);
        });
        const runRate = D_elapsed >= 3 ? S_actual / D_elapsed : 0;
        cum += runRate;
      } else {
        cum += d.value;
        actualSum += d.value;
      }
      d.cumulative = cum;
    });

    // Debug: log total sum for comparison with metrics API
    console.log(`Chart ${metric} - Actual sum (non-projected):`, actualSum);
    console.log(`Chart ${metric} - Date range:`, { from: chartDates[0]?.toISOString().split('T')[0], to: chartDates[chartDates.length-1]?.toISOString().split('T')[0] });
    console.log(`Chart ${metric} - Data points:`, chartData.filter(d => !d.isProjected).length, 'actual,', chartData.filter(d => d.isProjected).length, 'projected');

    // For expenses and savings, split cumulative into actual and projected lines
    if (metric === 'expenses' || metric === 'savings') {
      const lastActualIndex = chartData.findLastIndex((d) => !d.isProjected);
      if (lastActualIndex >= 0) {
        chartData.forEach((d, i) => {
          d.actualCum = i <= lastActualIndex ? d.cumulative : null;
          d.projectedCum = i >= lastActualIndex ? d.cumulative : null;
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

  const cumulativeCurrent = React.useMemo<ChartDatum[]>(() => {
    return current.map(d => ({
      ...d,
      cumulative: current.slice(0, current.indexOf(d) + 1).reduce((acc, curr) => acc + (curr.value || 0), 0),
    }))
  }, [current])

  const projectedEomExpenses = React.useMemo(() => {
  if (!data || data.length === 0) return 0

  // --- Always project for the current month ---
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  endOfMonth.setHours(0, 0, 0, 0)

  // Build a map of daily totals from the entire dataset
  const dataMap = new Map<number, { expenses: number; income: number }>()
  data.forEach((d: TimeseriesPoint) => {
    const [year, month, day] = d.date.split('-').map(Number)
    const dt = new Date(year, month - 1, day)
    dt.setHours(0, 0, 0, 0)
    dataMap.set(+dt, {
      expenses: convertAmount(d.expenses || 0, 'EUR', baseCurrency),
      income: convertAmount(d.income || 0, 'EUR', baseCurrency),
    })
  })

  // Get elapsed and remaining days of the current month
  const elapsedDates = getAllDates(firstOfMonth, today)
  const daysElapsed = elapsedDates.length

  let totalExpensesMTD = 0
  elapsedDates.forEach(dt => {
    const entry = dataMap.get(+dt)
    if (entry) totalExpensesMTD += entry.expenses
  })

  const absMTD = Math.abs(totalExpensesMTD)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const remainingDates = tomorrow <= endOfMonth ? getAllDates(tomorrow, endOfMonth) : []
  const remainingDays = remainingDates.length

  if (daysElapsed <= 0) return 0
  if (remainingDays <= 0) return absMTD

  const dailyBurn = absMTD / daysElapsed
  const projectedEOM = absMTD + dailyBurn * remainingDays

  return projectedEOM
}, [data, baseCurrency, convertAmount]) // <- dateRange intentionally excluded



  const renderChart = () => {
    if (metric === "savings") {
      const doProject = current.some((d: ChartDatum) => d.isProjected)
      const lastPoint = current[current.length - 1]
      
      // Calculate proper Y-axis domain for better scaling
      const allValues = current.map(d => d.cumulative).filter(v => !isNaN(v))
      const minValue = Math.min(...allValues)
      const maxValue = Math.max(...allValues)
      const padding = Math.max(100, (maxValue - minValue) * 0.1) // 10% padding or minimum 100 units
      const domain = [Math.max(0, minValue - padding), maxValue + padding]
      
      return (
        <ComposedChart accessibilityLayer data={current} margin={{ left: 12, right: 12 }}>
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
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
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
        </ComposedChart>
      )
    }

    if (metric === "expenses") {
      const barKey = (d: ChartDatum): number | null => d.isProjected ? 0 : d.value
      const doProject = current.some((d: ChartDatum) => d.isProjected)
      const lastPoint = current[current.length - 1]
      
      // Calculate proper Y-axis domains for better scaling
      const allValues = current.map(d => d.value).filter(v => !isNaN(v) && v !== null)
      const allCumulative = current.map(d => d.cumulative).filter(v => !isNaN(v))
      const minValue = Math.min(...allValues)
      const maxValue = Math.max(...allValues)
      const minCumulative = Math.min(...allCumulative)
      const maxCumulative = Math.max(...allCumulative)
      
      const valuePadding = Math.max(50, (maxValue - minValue) * 0.1)
      const cumPadding = Math.max(100, (maxCumulative - minCumulative) * 0.1)
      
      const valueDomain = [Math.max(0, minValue - valuePadding), maxValue + valuePadding]
      const cumDomain = [Math.max(0, minCumulative - cumPadding), maxCumulative + cumPadding]
      
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
            domain={valueDomain}
            tickFormatter={(value) => nf.format(value)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            domain={cumDomain}
            tickFormatter={(value) => nf.format(value)}
          />
          <ChartTooltip
            cursor={false}
            content={({ label, payload }) => {
              if (!payload?.length) return null

              const data = payload[0].payload
              const dailyV = data.value as number
              const cumV = data.actualCum as number | null
              const isProjected = data.isProjected

              const formattedDaily = nf.format(dailyV)
              const formattedCum = cumV != null ? nf.format(cumV) : 'N/A'
              const tooltipContent = isProjected 
                ? `No data yet`
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
            yAxisId="left"
            dataKey="value"
            fill="var(--chart-1)"
            radius={0}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="actualCum"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      )
    }

    // Income - standard bar chart
    const allValues = current.map(d => d.value).filter(v => !isNaN(v))
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const padding = Math.max(50, (maxValue - minValue) * 0.1)
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
           <CardDescription className="mt-1 relative group">
            <span>
              Cumulative: {nf.format(cumulativeCurrent?.[cumulativeCurrent.length - 1]?.cumulative ?? 0)}
            </span>
            <span className="inline mx-2 text-muted-foreground">|</span>
            <span>
              Projection: {nf.format((projectedEomExpenses as number) ?? 0)}
            </span>

            {/* Info icon as a focusable button for a11y */}
            <button
              type="button"
              className="ml-2 inline-flex items-center align-middle text-muted-foreground group-hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
              aria-describedby="proj-tip"
              tabIndex={0}
            >
              <svg
                className="h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                <text x="10" y="15" textAnchor="middle" fontSize="12" fill="currentColor">i</text>
              </svg>
            </button>

            {/* Tooltip */}
            <div
              id="proj-tip"
              role="tooltip"
              className="absolute left-0 mt-2 z-10 hidden w-80 rounded-lg bg-popover p-3 text-xs text-muted-foreground shadow-lg group-hover:block group-focus-within:block"
            >
              {/* <div className="font-medium text-foreground mb-1">How projection is calculated</div> */}
              <ul className="list-disc ml-4 space-y-1">
                <li><span className="text-foreground">Projection</span> = Current total + (Daily burn × Remaining days).</li>
                <li>Daily burn = Total spent this month ÷ Days elapsed this month.</li>
                <li>Remaining days = Tomorrow through the last day of <span className="text-foreground">this month</span>.</li>
              </ul>
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