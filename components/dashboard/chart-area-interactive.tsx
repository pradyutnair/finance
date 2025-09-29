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

function endOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  d.setHours(0, 0, 0, 0)
  return d
}

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
    if (!dateRange?.from || !dateRange?.to) return [];

    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
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

    const elapsedEnd = new Date(Math.min(to.getTime(), today.getTime()));
    let projectEnd = elapsedEnd;
    let runRate = 0;
    let doProject = false;

    if (metric === 'expenses' || metric === 'savings') {
      const sevenLater = new Date(today.getTime() + 7 * 86400000);
      projectEnd = new Date(Math.min(to.getTime(), sevenLater.getTime()));
      const elapsedDates = getAllDates(from, elapsedEnd);
      const D_elapsed = elapsedDates.length;
      let S_actual = 0;
      elapsedDates.forEach((dt) => {
        S_actual += getValueForDate(dt, metric);
      });
      runRate = D_elapsed >= 3 ? S_actual / D_elapsed : 0;
      doProject = projectEnd > today;
      if (!doProject) projectEnd = elapsedEnd;
    } else if (metric === 'income') {
      projectEnd = elapsedEnd;
    }

    const chartDates = getAllDates(from, projectEnd);
    const chartData: ChartDatum[] = chartDates.map((dt) => {
      const isProjected = dt > today;
      let value = isProjected ? runRate : getValueForDate(dt, metric);
      return {
        date: dt.toISOString(),
        value,
        isProjected,
        cumulative: 0,
      };
    });

    let cum = 0;
    chartData.forEach((d) => {
      cum += d.value;
      d.cumulative = cum;
    });

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

  const projectedEomExpenses = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null

    const from = new Date(dateRange.from)
    from.setHours(0, 0, 0, 0)
    const to = new Date(dateRange.to)
    to.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const elapsedEnd = new Date(Math.min(to.getTime(), today.getTime()))

    // Focus projection on the current month-to-date window
    const monthStart = new Date(elapsedEnd.getFullYear(), elapsedEnd.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const start = from > monthStart ? from : monthStart

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

    const elapsedDates = getAllDates(start, elapsedEnd)
    const daysElapsed = elapsedDates.length
    let actualMtd = 0
    elapsedDates.forEach((dt) => {
      const key = dt.getTime()
      const entry = dataMap.get(key) || { expenses: 0, income: 0 }
      actualMtd += entry.expenses
    })

    const eom = endOfMonth(elapsedEnd)
    const nextDay = new Date(elapsedEnd)
    nextDay.setDate(nextDay.getDate() + 1)
    const remainingDates = nextDay <= eom ? getAllDates(nextDay, eom) : []
    const remainingDays = remainingDates.length

    if (remainingDays <= 0) return Math.max(0, actualMtd)

    const runRate = daysElapsed > 0 ? actualMtd / daysElapsed : 0
    const projected = actualMtd + runRate * remainingDays
    return Math.max(0, projected)
  }, [data, dateRange, baseCurrency, convertAmount])

  const renderChart = () => {
    if (metric === "savings") {
      const doProject = current.some((d: ChartDatum) => d.isProjected)
      const lastPoint = current[current.length - 1]
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

              const data = payload[0].payload
              const v = data.cumulative as number
              const isProjected = data.isProjected

              const formattedValue = nf.format(v)
              const labelPrefix = isProjected ? "Projected: " : ""

              const formattedDate = new Date(label).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })

              return (
                <div className="rounded-lg bg-popover p-2 shadow-md">
                  <div className="font-bold text-2xl text-foreground">
                    {labelPrefix}{formattedValue}
                  </div>
                  <div className="text-xs text-muted-foreground">{formattedDate}</div>
                </div>
              )
            }}
          />
          <Area
            type="natural"
            dataKey="actualCum"
            fill="url(#fillSavings)"
            stroke="var(--chart-1)"
            strokeWidth={2}
          />
          <Line
            type="natural"
            dataKey="projectedCum"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
          {doProject && (
            <Scatter
              data={[lastPoint]}
              dataKey="cumulative"
              shape={(props: any) => {
                const {
                  cx,
                  cy,
                  onMouseEnter,
                  onMouseLeave,
                  onClick,
                  className,
                  style,
                  transform,
                  clipPath,
                  opacity,
                } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="var(--chart-1)"
                    stroke="#fff"
                    strokeWidth={1}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={onClick}
                    className={className}
                    style={style}
                    transform={transform}
                    clipPath={clipPath}
                    opacity={opacity}
                  />
                );
              }}
              legendType="none"
            />
          )}
        </ComposedChart>
      )
    }

    if (metric === "expenses") {
      const barKey = (d: ChartDatum): number | null => d.isProjected ? null : d.value
      const doProject = current.some((d: ChartDatum) => d.isProjected)
      const lastPoint = current[current.length - 1]
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
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
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
              const labelPrefix = isProjected ? "Projected " : ""
              const tooltipContent = isProjected 
                ? `${labelPrefix}Total: ${formattedCum}`
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
            dataKey={barKey}
            fill="var(--chart-1)"
            radius={0}
            yAxisId="left"
          />
          <Line
            type="monotone"
            dataKey="actualCum"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            yAxisId="right"
          />
          <Line
            type="monotone"
            dataKey="projectedCum"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            yAxisId="right"
          />
          {doProject && (
            <Scatter
              data={[lastPoint]}
              dataKey="cumulative"
              yAxisId="right"
              shape={(props: any) => {
                const {
                  cx,
                  cy,
                  onMouseEnter,
                  onMouseLeave,
                  onClick,
                  className,
                  style,
                  transform,
                  clipPath,
                  opacity,
                } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="var(--chart-2)"
                    stroke="#fff"
                    strokeWidth={1}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={onClick}
                    className={className}
                    style={style}
                    transform={transform}
                    clipPath={clipPath}
                    opacity={opacity}
                  />
                );
              }}
              legendType="none"
            />
          )}
        </ComposedChart>
      )
    }

    // Income - standard bar chart
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
              Projected = (Total so far / Days elapsed) × Total days in month.<br />
              This estimates your end-of-month expenses if you continue spending at the current daily average.
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