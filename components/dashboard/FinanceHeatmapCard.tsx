"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { useTransactions } from "@/lib/api"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Flame } from "lucide-react"

type HeatmapMode = "spending" | "savings" | "net"

const SAVINGS_CATEGORIES = new Set(["Savings", "Investment"])

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatMonthShort(date: Date): string {
  return date.toLocaleString("en-US", { month: "short" })
}

function formatIsoDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const r = Math.round(lerp(a.r, b.r, t))
  const g = Math.round(lerp(a.g, b.g, t))
  const bch = Math.round(lerp(a.b, b.b, t))
  return `rgb(${r}, ${g}, ${bch})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  }
}

function netToColor(value: number, maxAbs: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return "rgba(0,0,0,0.05)"
  const t = clamp01(Math.abs(value) / maxAbs)
  if (Math.abs(value) < maxAbs * 0.02) return "rgba(0,0,0,0.08)"
  // Positive → savings (green), Negative → spending (brown #40221a)
  return value >= 0 ? lerpHexColor("#f0fdf4", "#14532d", t) : lerpHexColor("#f2ebe9", "#40221a", t)
}

function isNoSpendDay(day: AggregatedDay): boolean {
  return (day.expenses ?? 0) === 0
}

type AggregatedDay = {
  dateKey: string
  date: Date
  income: number
  expenses: number
  savings: number
  net: number
  categories: Record<string, number>
}

export function FinanceHeatmapCard() {
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol, formatAmount } = useCurrency()
  const [mode, setMode] = useState<HeatmapMode>("net")
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all")
  const [dailySavingsGoal, setDailySavingsGoal] = useState<number>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("nexpass_daily_savings_goal") : null
      return raw ? parseFloat(raw) : 0
    } catch { return 0 }
  })

  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem("nexpass_daily_savings_goal", String(dailySavingsGoal || 0)) } catch {}
  }, [dailySavingsGoal])

  const apiDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    }
    return undefined
  }, [dateRange, formatDateForAPI])

  const { data, isLoading, error } = useTransactions({ dateRange: apiDateRange })

  const transactions = data?.transactions || []

  const { weeks, monthTicks } = useMemo(() => {
    const from = dateRange?.from ? new Date(dateRange.from) : new Date()
    const to = dateRange?.to ? new Date(dateRange.to) : new Date()
    const start = startOfWeek(addDays(from, 0))
    const end = endOfWeek(addDays(to, 0))

    const days: Date[] = []
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) days.push(new Date(d))

    const weeks: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    const monthTicks: { index: number; month: string; year: number }[] = []
    let lastMonth = -1
    let lastYear = -1
    
    weeks.forEach((w, idx) => {
      const firstDay = w[0]
      const month = firstDay.getMonth()
      const year = firstDay.getFullYear()
      
      if (idx === 0 || month !== lastMonth || year !== lastYear) {
        monthTicks.push({ 
          index: idx, 
          month: formatMonthShort(firstDay),
          year: year
        })
        lastMonth = month
        lastYear = year
      }
    })

    return { weeks, monthTicks }
  }, [dateRange])

  const dayMap: Record<string, AggregatedDay> = useMemo(() => {
    const map: Record<string, AggregatedDay> = {}
    weeks.flat().forEach((d) => {
      const key = formatIsoDate(d)
      map[key] = {
        dateKey: key,
        date: d,
        income: 0,
        expenses: 0,
        savings: 0,
        net: 0,
        categories: {},
      }
    })

    for (const tx of transactions) {
      const dt = new Date((tx as any).bookingDate || (tx as any).date)
      const key = formatIsoDate(dt)
      if (!map[key]) continue
      const amountOriginal = Number((tx as any).amount) || 0
      const curr = (tx as any).currency || "EUR"
      const amount = convertAmount(amountOriginal, curr, baseCurrency)
      const cat = (tx as any).category || "Uncategorized"

      if (amount > 0) {
        map[key].income += amount
        if (SAVINGS_CATEGORIES.has(cat)) {
          map[key].savings += amount
        }
      } else if (amount < 0) {
        map[key].expenses += Math.abs(amount)
      }
      map[key].net = map[key].income - map[key].expenses
      map[key].categories[cat] = (map[key].categories[cat] || 0) + Math.abs(amount)
    }
    return map
  }, [transactions, weeks, convertAmount, baseCurrency])

  const valuesForScale = useMemo(() => {
    const vals: number[] = []
    Object.values(dayMap).forEach((d) => {
      const v = mode === "spending" ? -d.expenses : mode === "savings" ? d.savings : d.net
      if (Number.isFinite(v) && v !== 0) vals.push(v)
    })
    const maxAbs = vals.length ? Math.max(...vals.map((v) => Math.abs(v))) : 0
    return { maxAbs }
  }, [dayMap, mode])

  const categoryOptions = useMemo(() => {
    const s = new Set<string>(["all"]) 
    transactions.forEach((t: any) => s.add(t.category || "Uncategorized"))
    return Array.from(s).sort()
  }, [transactions])

  // Make cells large by default; still responsive to very long ranges
  const cellSize = weeks.length > 24 ? "h-7 w-7" : weeks.length > 16 ? "h-9 w-9" : "h-10 w-10"
  const gap = weeks.length > 24 ? "gap-1" : weeks.length > 16 ? "gap-1.5" : "gap-2"
  const cellPx = weeks.length > 24 ? 28 : weeks.length > 16 ? 36 : 48
  const gapPx = weeks.length > 24 ? 4 : weeks.length > 16 ? 6 : 8
  const dayLabelColPx = cellPx + 8

  // Compute day-of-week labels based on the first week (ensures correct order)
  const dayLabels = useMemo(() => {
    const firstWeek = weeks[0]
    if (!firstWeek || firstWeek.length !== 7) return ["M","T","W","T","F","S","S"]
    return firstWeek.map((d) => d.toLocaleDateString(undefined, { weekday: 'narrow' }))
  }, [weeks])

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Finance Heatmap</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-4 pb-4">
          <div className="space-y-1.5">
            {[...Array(7)].map((_, r) => (
              <div key={r} className="flex gap-1.5">
                {[...Array(Math.min(14, weeks.length))].map((_, c) => (
                  <Skeleton key={c} className={cellSize + " rounded"} />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-base font-semibold">Finance Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-4 pb-4">
          <div className="text-center text-muted-foreground space-y-2">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
            <div className="text-sm">Failed to load data</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isEmpty = (transactions?.length || 0) === 0

  const toggleOptions: Array<{ k: HeatmapMode; label: string; icon: any }> = [
    { k: "spending", label: "Spending", icon: TrendingDown },
    { k: "savings", label: "Savings", icon: TrendingUp },
    { k: "net", label: "Net Flow", icon: Minus },
  ]

  return (
    <Card className="h-full min-h-[400px] max-h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4">
        <CardTitle className="text-base font-medium">Finance Heatmap</CardTitle>
        <Flame className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      <CardContent className="flex-1 px-4 pb-3 overflow-hidden">
        {/* Centered filters */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
          <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
            {toggleOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.k}
                  onClick={() => setMode(opt.k)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${
                    mode === opt.k
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-7 rounded-md border bg-background px-2 text-[10px] font-medium"
          >
            <option value="all">All Categories</option>
            {categoryOptions.filter(c => c !== "all").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 px-2 py-1 rounded-md border bg-background">
            <span className="text-[10px] text-muted-foreground">Goal:</span>
            <input
              type="number"
              className="w-14 bg-transparent text-[10px] text-right font-mono focus:outline-none"
              value={dailySavingsGoal || ""}
              onChange={(e) => setDailySavingsGoal(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <span className="text-[10px] text-muted-foreground">{getCurrencySymbol(baseCurrency)}</span>
          </div>
        </div>

        {/* Grid/empty state */}
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <Minus className="w-8 h-8 mx-auto text-muted-foreground/30" />
              <div className="text-xs text-muted-foreground">No transactions found</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center">
            {/* Month labels - centered */}
            <div className="relative w-fit mx-auto text-[11px] font-medium text-muted-foreground mb-2">
              {monthTicks.map((tick, i) => {
                const spacing = tick.index * (cellPx + gapPx)
                
                return (
                  <div 
                    key={i} 
                    className="absolute"
                    style={{ left: `${dayLabelColPx + spacing}px` }}
                  >
                    {tick.month}
                    {monthTicks.length <= 3 && (
                      <span className="ml-0.5 text-[9px] opacity-60">{tick.year}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Main heatmap grid */}
            <div className="flex-1 flex items-center justify-center overflow-visible py-2">
              <div className="flex gap-3">
                {/* Day labels */}
                <div className={`flex flex-col ${gap} text-[9px] font-medium text-muted-foreground`}>
                  {dayLabels.map((d, i) => (
                    <div key={`dow-${i}`} className={`${cellSize.split(' ')[0]} flex items-center justify-center`}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Heatmap cells */}
                <div className={`flex ${gap}`}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className={`flex flex-col ${gap}`}>
                      {week.map((day, di) => {
                        const key = formatIsoDate(day)
                        const d = dayMap[key]
                        const raw = mode === "spending" ? -d.expenses : mode === "savings" ? d.savings : d.net
                        const color = netToColor(raw, valuesForScale.maxAbs)
                        const showOutline = dailySavingsGoal > 0 && d.savings >= dailySavingsGoal
                        const showStreak = isNoSpendDay(d)

                        const filteredCats = Object.entries(d.categories)
                          .filter(([name]) => categoryFilter === "all" || name === categoryFilter)

                        return (
                          <Tooltip key={`${wi}-${di}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={`${cellSize} rounded cursor-pointer transition-all hover:scale-110 hover:shadow-lg relative`}
                                style={{ 
                                  background: color,
                                  outline: showOutline ? "2px solid #f59e0b" : undefined,
                                  outlineOffset: showOutline ? 1 : undefined,
                                }}
                              >
                                {showStreak && (
                                  <div className="absolute inset-0 rounded ring-1 ring-emerald-500/50" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="p-2">
                              <div className="space-y-1.5 text-xs">
                                <div className="font-semibold border-b pb-1">
                                  {day.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                </div>
                                
                                <div className="space-y-0.5">
                                  <div className="flex justify-between gap-4">
                                    <span>Net:</span>
                                    <span className={`font-mono font-semibold ${d.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatAmount(d.net, baseCurrency)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Spending:</span>
                                    <span className="font-mono">{formatAmount(-d.expenses, baseCurrency)}</span>
                                  </div>
                                  
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Savings:</span>
                                    <span className="font-mono">{formatAmount(d.savings, baseCurrency)}</span>
                                  </div>
                                </div>

                                {filteredCats.length > 0 && (
                                  <div className="pt-1 border-t space-y-0.5">
                                    <div className="text-[10px] font-medium opacity-60">Top Categories:</div>
                                    {filteredCats.slice(0, 3).map(([name, amt]) => (
                                      <div key={name} className="flex justify-between gap-3 text-[11px]">
                                        <span className="truncate">{name}</span>
                                        <span className="font-mono">{formatAmount(-Math.abs(amt), baseCurrency)}</span>
                                      </div>
                                    ))}
                                    {filteredCats.length > 3 && (
                                      <div className="text-[10px] opacity-50">+{filteredCats.length - 3} more</div>
                                    )}
                                  </div>
                                )}

                                {(showStreak || showOutline) && (
                                  <div className="pt-1 border-t text-[10px]">
                                    {showStreak && <div className="text-emerald-600">✓ No-spend day</div>}
                                    {showOutline && <div className="text-amber-600">★ Goal reached</div>}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend - Ultra compact */}
            <div className="mt-2 pt-2 border-t flex items-center justify-center gap-6 text-[9px]">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Less</span>
                <div className="flex gap-0.5">
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
                    <div 
                      key={t}
                      className="w-3 h-3 rounded-sm"
                      style={{ 
                        background: mode === "spending" 
                          ? lerpHexColor("#f2ebe9", "#40221a", t)
                          : lerpHexColor("#f0fdf4", "#14532d", t)
                      }}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground">
                  More {mode === "spending" ? "Spending" : mode === "savings" ? "Savings" : "Net"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default FinanceHeatmapCard