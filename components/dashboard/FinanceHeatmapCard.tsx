"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"
import { useTransactions } from "@/lib/api"
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Flame } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type HeatmapMode = "spending" | "savings" | "net"

const SAVINGS_CATEGORIES = new Set(["Savings", "Investment"])
const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

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
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}
function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const r = Math.round(lerp(a.r, b.r, t))
  const g = Math.round(lerp(a.g, b.g, t))
  const bch = Math.round(lerp(a.b, b.b, t))
  return `rgb(${r}, ${g}, ${bch})`
}
function netToColor(value: number, maxAbs: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(maxAbs) || maxAbs <= 0) return "rgba(0,0,0,0.05)"
  const t = clamp01(Math.abs(value) / maxAbs)
  if (Math.abs(value) < maxAbs * 0.02) return "rgba(0,0,0,0.08)"
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

  const [maxSpendThreshold, setMaxSpendThreshold] = useState<number>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("nexpass_max_spend_threshold") : null
      return raw ? parseFloat(raw) : 0
    } catch { return 0 }
  })
  useEffect(() => {
    try { if (typeof window !== "undefined") window.localStorage.setItem("nexpass_max_spend_threshold", String(maxSpendThreshold || 0)) } catch {}
  }, [maxSpendThreshold])
  const [editingMax, setEditingMax] = useState(false)

  const apiDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { from: formatDateForAPI(dateRange.from), to: formatDateForAPI(dateRange.to) }
    }
    return undefined
  }, [dateRange, formatDateForAPI])

  const { data, isLoading, error } = useTransactions({ dateRange: apiDateRange })
  const transactions = data?.transactions || []

  // Build continuous week rows that cover the selected range
  const { fromDate, toDate, weeks } = useMemo(() => {
    const from = dateRange?.from ? new Date(dateRange.from) : new Date()
    const to = dateRange?.to ? new Date(dateRange.to) : new Date()
    const start = startOfWeek(from)
    const end = endOfWeek(to)

    const rows: Date[][] = []
    for (let wStart = new Date(start); wStart <= end; wStart = addDays(wStart, 7)) {
      const row: Date[] = []
      for (let i = 0; i < 7; i++) row.push(addDays(wStart, i))
      rows.push(row)
    }
    return { fromDate: from, toDate: to, weeks: rows }
  }, [dateRange])

  // Aggregate per day for the entire covered range
  const dayMap: Record<string, AggregatedDay> = useMemo(() => {
    const map: Record<string, AggregatedDay> = {}
    weeks.flat().forEach((d) => {
      const key = formatIsoDate(d)
      map[key] = { dateKey: key, date: d, income: 0, expenses: 0, savings: 0, net: 0, categories: {} }
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
        if (SAVINGS_CATEGORIES.has(cat)) map[key].savings += amount
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

  // Streaks over visible range
  const orderedDays = useMemo(() => weeks.flat(), [weeks])
  const longestNoSpendStreak = useMemo(() => {
    let max = 0, cur = 0
    for (const day of orderedDays) {
      const d = dayMap[formatIsoDate(day)]
      if (d && (d.expenses ?? 0) === 0) cur += 1
      else { if (cur > max) max = cur; cur = 0 }
    }
    return Math.max(max, cur)
  }, [orderedDays, dayMap])
  const longestUnderThresholdStreak = useMemo(() => {
    const thr = Math.max(0, maxSpendThreshold || 0)
    let max = 0, cur = 0
    for (const day of orderedDays) {
      const d = dayMap[formatIsoDate(day)]
      if (d && (d.expenses ?? 0) <= thr) cur += 1
      else { if (cur > max) max = cur; cur = 0 }
    }
    return Math.max(max, cur)
  }, [orderedDays, dayMap, maxSpendThreshold])

  const categoryOptions = useMemo(() => {
    const s = new Set<string>(["all"])
    transactions.forEach((t: any) => s.add(t.category || "Uncategorized"))
    return Array.from(s).sort()
  }, [transactions])


  // Dynamic sizing and centering for one single stacked grid
  const gridBoxRef = useRef<HTMLDivElement | null>(null)
  const [boxW, setBoxW] = useState<number>(0)
  const [boxH, setBoxH] = useState<number>(0)
  useEffect(() => {
    const el = gridBoxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      setBoxW(r.width)
      setBoxH(r.height)
    })
    ro.observe(el)
    const r0 = el.getBoundingClientRect()
    setBoxW(r0.width)
    setBoxH(r0.height)
    return () => ro.disconnect()
  }, [])

  // Dynamic sizing - width-driven baseline; vertical scroll for long ranges
  const daysCount = weeks.flat().length || 1
  const rows = Math.max(weeks.length, 1)
  const cols = 7
  const headerH = 20 // height for MTWTFSS row

  // Keep a constant small gap so width-based cell size is stable across ranges
  const gapPx = 2

  // Available width/height inside the measured box
  const padding = 6 // tiny safety padding
  const availableWidth = Math.max(0, boxW - padding)
  const availableHeight = Math.max(0, boxH - headerH - 4)

  // Baseline cell size from width so grid always fills card width
  const widthCell = Math.max(8, Math.floor((availableWidth - (cols - 1) * gapPx) / cols))

  // Height-constrained cell size (only applied for short ranges)
  const heightCell = Math.max(8, Math.floor((availableHeight - (rows - 1) * gapPx) / rows))

  // If the range is short (<= 35 days), fit both width and height.
  // If longer, keep the width-driven size and allow vertical scrolling.
  let cellPx = daysCount > 35 ? widthCell : Math.min(widthCell, heightCell)

  // Aesthetic caps for very short ranges
  if (daysCount <= 7) cellPx = Math.min(cellPx, 56)
  else if (daysCount <= 14) cellPx = Math.min(cellPx, 48)
  else if (daysCount <= 30) cellPx = Math.min(cellPx, 40)

  const gridTotalWidth = cols * cellPx + (cols - 1) * gapPx
  const gridTotalHeight = headerH + rows * cellPx + (rows - 1) * gapPx

  const isEmpty = (transactions?.length || 0) === 0

  const toggleOptions: Array<{ k: HeatmapMode; label: string; icon: any }> = [
    { k: "spending", label: "Spending", icon: TrendingDown },
    { k: "savings", label: "Savings", icon: TrendingUp },
    { k: "net", label: "Net Flow", icon: Minus },
  ]

  // Helpers
  function dayValue(d: AggregatedDay) {
    return mode === "spending" ? -d.expenses : mode === "savings" ? d.savings : d.net
  }

  function DayCell({ date }: { date: Date }) {
    const key = formatIsoDate(date)
    const d = dayMap[key]
    const disabled = date < startOfWeek(fromDate) || date > endOfWeek(toDate) || !d
    const filteredCats = d
      ? Object.entries(d.categories).filter(([name]) => categoryFilter === "all" || name === categoryFilter)
      : []

    const raw = d ? dayValue(d) : 0
    const color = d ? netToColor(raw, valuesForScale.maxAbs) : "rgba(0,0,0,0.04)"
    const showOutline = d && dailySavingsGoal > 0 && d.savings >= dailySavingsGoal
    const showStreak = d ? isNoSpendDay(d) : false
    const showUnderMax = d && !showStreak && maxSpendThreshold > 0 && d.expenses <= maxSpendThreshold

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="rounded cursor-pointer transition-transform hover:scale-110 hover:shadow-lg relative"
            style={{
              height: cellPx,
              width: cellPx,
              background: disabled ? "rgba(0,0,0,0.04)" : color,
              outline: showOutline ? "2px solid #f59e0b" : undefined,
              outlineOffset: showOutline ? 1 : undefined,
              opacity: disabled ? 0.35 : 1,
            }}
          >
            {!disabled && showStreak && <div className="absolute inset-0 rounded ring-1 ring-gray-500/60" />}
            {!disabled && !showStreak && showUnderMax && <div className="absolute inset-0 rounded ring-1 ring-chart-1/70" />}
          </div>
        </TooltipTrigger>
        {!disabled && d && (
          <TooltipContent side="top" className="p-2">
            <div className="space-y-1.5 text-xs">
              <div className="font-semibold border-b pb-1">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
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
        )}
      </Tooltip>
    )
  }

  // Loading and error states
  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 px-4">
          <CardTitle className="text-base font-semibold">Heatmap</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-4 pb-4">
          <div className="space-y-2">
            {[...Array(8)].map((_, r) => (
              <div key={r} className="flex items-center gap-2">
                <Skeleton className="h-4 w-12 rounded" />
                {[...Array(7)].map((__, c) => <Skeleton key={c} className="h-5 w-5 rounded" />)}
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
          <CardTitle className="text-base font-semibold">Heatmap</CardTitle>
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

  // Controls width alignment
  const toggleWidthRef = useRef<HTMLDivElement | null>(null)
  const [toggleRowWidth, setToggleRowWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = toggleWidthRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (typeof w === "number") setToggleRowWidth(w)
    })
    ro.observe(el)
    setToggleRowWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  function renderLegend() {
    if (mode === "net") {
      return (
        <div className="mt-2 pt-2 border-t flex items-center justify-center gap-6 text-[9px]">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Spending</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
                <div key={`neg-${t}`} className="w-3 h-3 rounded-sm" style={{ background: lerpHexColor("#f2ebe9", "#40221a", t) }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Savings</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
                <div key={`pos-${t}`} className="w-3 h-3 rounded-sm" style={{ background: lerpHexColor("#f0fdf4", "#14532d", t) }} />
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
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
            More {mode === "spending" ? "Spending" : "Savings"}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Card className="h-full min-h-[420px] max-h-[640px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4">
        <CardTitle className="text-base font-medium">Heatmap</CardTitle>
        <Flame className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      {/* Zero horizontal padding to avoid cut off. Inner sections manage their own padding. */}
      <CardContent className="flex-1 px-0 pb-3 overflow-hidden">
        {/* Controls */}
        <div className="w-full flex items-center justify-center mb-1 px-3">
          <div className="w-full max-w-[980px] flex flex-col items-center gap-1.5">
            {/* Row 1: Mode toggle */}
            <div className="flex items-center justify-center">
              <div ref={toggleWidthRef} className="inline-flex rounded-md border bg-muted/30 p-0.5 h-8">
                {toggleOptions.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.k}
                      onClick={() => setMode(opt.k)}
                      className={`flex items-center gap-6 px-2 py-1 text-xs font-medium rounded transition-all ${
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
            </div>

            {/* Row 2: Category + Max spend aligned to toggle width */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2" style={{ width: toggleRowWidth ?? undefined }}>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 flex-1 min-w-0 rounded-md border bg-background px-3 text-xs font-medium shadow-sm">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryOptions.filter(c => c !== "all").map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div
                  className="flex items-center gap-2 px-2 h-8 rounded-md border bg-background text-xs text-muted-foreground group/goal flex-none"
                  onClick={() => setEditingMax(true)}
                >
                  <span className="text-muted-foreground">Max spend</span>
                  <span className="text-muted-foreground">{getCurrencySymbol(baseCurrency)}</span>
                  {editingMax ? (
                    <Input
                      autoFocus
                      inputMode="decimal"
                      className="h-6 w-20 text-xs px-2 bg-transparent border-muted-foreground/20"
                      value={Number.isFinite(maxSpendThreshold) ? String(maxSpendThreshold) : ""}
                      onChange={(e) => setMaxSpendThreshold(parseFloat(e.target.value) || 0)}
                      onBlur={() => setEditingMax(false)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingMax(false) }}
                      placeholder="0"
                    />
                  ) : (
                    <span className={`font-semibold text-foreground/90 ${Number.isFinite(maxSpendThreshold) && maxSpendThreshold > 0 ? "" : "text-muted-foreground/60"}`}>
                      {Number.isFinite(maxSpendThreshold) && maxSpendThreshold > 0 ? maxSpendThreshold : "0"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Streaks */}
            <div className="flex items-center justify-center gap-6 text-[11px] text-muted-foreground mt-0.5">
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-500" />
                <span>No-spend: <span className="text-foreground font-semibold">{longestNoSpendStreak}d</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Under max: <span className="text-foreground font-semibold">{longestUnderThresholdStreak}d</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Single stacked calendar grid (centered). MTWTFSS are columns. Weeks are rows. */}
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center ">
              <Minus className="w-8 h-8 mx-auto text-muted-foreground/30" />
              <div className="text-xs text-muted-foreground">No transactions found</div>
            </div>
          </div>
          ) : (
            <div className="h-full w-full px-3 pb-2">
              {/* Box that we measure for dynamic sizing */}
              <div
                ref={gridBoxRef}
                className={"h-full w-full flex flex-col items-center justify-center " + (daysCount > 35 ? "overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20" : "overflow-hidden")}
                style={{ maxHeight: daysCount > 35 ? gridTotalHeight : undefined }}
              >
                {/* Header row: MTWTFSS */}
                <div className="flex items-center justify-center mb-1" style={{ gap: gapPx, height: headerH }}>
                {DOW_LABELS.map((d, i) => (
                  <div key={`hd-${i}`} className="text-[10px] text-muted-foreground flex items-center justify-center" style={{ width: cellPx, height: headerH }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Week rows grid */}
                <div className="flex flex-col items-center justify-start flex-1 w-full" style={{ gap: gapPx }}>
                {weeks.map((week, ri) => (
                  <div key={`week-${ri}`} className="flex items-center justify-center" style={{ gap: gapPx }}>
                    {/* 7 day cells */}
                    {week.map((day, ci) => (
                      <DayCell key={`d-${ri}-${ci}`} date={day} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        {renderLegend()}
      </CardContent>
    </Card>
  )
}

export default FinanceHeatmapCard