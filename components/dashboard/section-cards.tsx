"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPigMoney,
  IconCreditCard,
  IconCoins,
  IconTarget,
} from "@tabler/icons-react"

import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useDateRange, useCurrency, useMetrics } from "@/lib/stores"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { account } from "@/lib/appwrite"

function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SectionCards() {
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, rates } = useCurrency()
  
  // State for goals (stored in EUR, converted for display)
  const [balanceGoal, setBalanceGoal] = useState<number>(0)
  const [savingsRateGoal, setSavingsRateGoal] = useState<number>(20)
  const [jwt, setJwt] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const didFetchRef = useRef(false)
  const [initialized, setInitialized] = useState(false)
  const [hasUserEdited, setHasUserEdited] = useState(false)
  
  console.log('SectionCards render - baseCurrency:', baseCurrency, 'rates loaded:', !!rates)
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { metrics, loading, fetchMetrics } = useMetrics()
  const [latestBalance, setLatestBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  
  // Fetch metrics when date range changes
  useEffect(() => {
    fetchMetrics(dateRangeForAPI)
  }, [dateRangeForAPI?.from, dateRangeForAPI?.to, fetchMetrics])

  // Fetch latest balance independently (no date filter)
  useEffect(() => {
    const fetchLatestBalance = async () => {
      try {
        const response = await fetch('/api/metrics', { 
          headers: await authHeaders() 
        })
        if (response.ok) {
          const data = await response.json()
          setLatestBalance(data.balance || 0)
        }
      } catch (error) {
        console.error('Failed to fetch latest balance:', error)
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchLatestBalance()
  }, [])

  const isLoading = loading

  // Auth headers for API calls
  const authHeaders = async (): Promise<HeadersInit> => {
    try {
      const token = jwt || (await account.createJWT()).jwt
      if (!jwt) setJwt(token)
      return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    } catch {
      return { 'Content-Type': 'application/json' }
    }
  }

  // Fetch goals from goals API
  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/budgets/goals', { headers: await authHeaders() })
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setBalanceGoal(data.balanceGoal || 0)
          setSavingsRateGoal(data.savingsRateGoal || 0)
          try {
            sessionStorage.setItem('budgetGoals', JSON.stringify({
              balanceGoal: Number(data.balanceGoal || 0),
              savingsRateGoal: Number(data.savingsRateGoal || 0),
            }))
          } catch {}
        }
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error)
    }
  }

  // Save goals function
  const saveGoals = async (newBalanceGoal?: number, newSavingsRateGoal?: number) => {
    try {
      const response = await fetch('/api/budgets/goals', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          ...(typeof newBalanceGoal === 'number' ? { balanceGoal: newBalanceGoal } : {}),
          ...(typeof newSavingsRateGoal === 'number' ? { savingsRateGoal: newSavingsRateGoal } : {}),
        }),
      })
      if (!response.ok) {
        console.error('Failed to save goals')
      }
      try {
        const cached = sessionStorage.getItem('budgetGoals')
        const prev = cached ? JSON.parse(cached) : {}
        sessionStorage.setItem('budgetGoals', JSON.stringify({
          balanceGoal: typeof newBalanceGoal === 'number' ? newBalanceGoal : prev.balanceGoal ?? balanceGoal,
          savingsRateGoal: typeof newSavingsRateGoal === 'number' ? newSavingsRateGoal : prev.savingsRateGoal ?? savingsRateGoal,
        }))
      } catch {}
    } catch (error) {
      console.error('Failed to save goals:', error)
    }
  }

  // Load goals on component mount
  useEffect(() => {
    if (didFetchRef.current) return
    didFetchRef.current = true

    try {
      const cached = sessionStorage.getItem('budgetGoals')
      if (cached) {
        const data = JSON.parse(cached)
        setBalanceGoal(Number(data.balanceGoal || 0))
        setSavingsRateGoal(Number(data.savingsRateGoal || 0))
        setInitialized(true)
        return
      }
    } catch {}

    fetchGoals().finally(() => setInitialized(true))
  }, [])

  // Save goals when they change (with debounce)
  useEffect(() => {
    if (!initialized || !hasUserEdited) return
    const timer = setTimeout(() => {
      const payload: { balanceGoal?: number; savingsRateGoal?: number } = {}
      if (typeof balanceGoal === 'number' && balanceGoal >= 0) payload.balanceGoal = balanceGoal
      if (typeof savingsRateGoal === 'number' && savingsRateGoal >= 0) payload.savingsRateGoal = savingsRateGoal
      if (Object.keys(payload).length > 0) saveGoals(payload.balanceGoal, payload.savingsRateGoal)
    }, 2000)
    return () => clearTimeout(timer)
  }, [balanceGoal, savingsRateGoal])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="relative overflow-hidden rounded-2xl border border-border bg-background/60 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="mt-4 h-9 w-24" />
            </CardHeader>
            <CardFooter className="pt-0">
              <Skeleton className="h-4 w-32" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="col-span-full p-6">
          <p className="text-center text-muted-foreground">
            Failed to load financial data. Please try again.
          </p>
        </Card>
      </div>
    )
  }

  const savingsRate = metrics.savingsRate
  const savingsProgress = Math.max(0, Math.min(100, (savingsRate / savingsRateGoal) * 100))
  
  // Convert balance goal to display currency for progress calculation
  const balanceGoalInDisplayCurrency = convertAmount(balanceGoal, 'EUR', baseCurrency)
  const balanceProgress = balanceGoal > 0 ? Math.max(0, Math.min(100, (Math.abs(metrics.balance || 0) / balanceGoal) * 100)) : 0

  console.log('SectionCards - metrics:', { 
    balance: metrics?.balance, 
    income: metrics?.income, 
    expenses: metrics?.expenses 
  })

  const testConversion = convertAmount(1000, 'EUR', baseCurrency)
  console.log('Test conversion: 1000 EUR ->', testConversion, baseCurrency)

  // Use latest balance (not filtered by date range) for balance card
  const displayBalance = latestBalance !== null ? latestBalance : (metrics?.balance || 0)
  const balanceProgressValue = balanceGoal > 0 ? Math.max(0, Math.min(100, (Math.abs(displayBalance) / balanceGoal) * 100)) : 0

  const cards = [
    {
      label: "Balance",
      value: formatCurrency(convertAmount(displayBalance, 'EUR', baseCurrency), baseCurrency),
      icon: <IconWallet className="size-5" />,
      delta: 0, // Balance doesn't show delta since it's not date-filtered
      kind: "balance" as const,
      goal: balanceGoalInDisplayCurrency,
      progress: balanceProgressValue,
      accentColor: "from-amber-500/10 to-amber-600/10",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-700 dark:text-amber-400",
    },
    {
      label: "Income",
      value: formatCurrency(convertAmount(metrics.income || 0, 'EUR', baseCurrency), baseCurrency),
      icon: <IconCoins className="size-5" />,
      delta: metrics.deltas?.incomePct ?? 0,
      kind: "income" as const,
      accentColor: "from-emerald-500/10 to-emerald-600/10",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "Expenses",
      value: formatCurrency(convertAmount(metrics.expenses || 0, 'EUR', baseCurrency), baseCurrency),
      icon: <IconCreditCard className="size-5" />,
      delta: metrics.deltas?.expensesPct ?? 0,
      kind: "expenses" as const,
      accentColor: "from-rose-500/10 to-rose-600/10",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-700 dark:text-rose-400",
    },
    {
      label: "Savings",
      value: `${metrics.savingsRate.toFixed(1)}%`,
      icon: <IconPigMoney className="size-5" />,
      delta: metrics.deltas?.savingsPct ?? 0,
      kind: "savings" as const,
      rate: savingsRate,
      goal: savingsRateGoal,
      progress: savingsProgress,
      accentColor: "from-blue-500/10 to-blue-600/10",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-700 dark:text-blue-400",
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="
            group relative overflow-hidden rounded-2xl border border-border/50
            bg-background/60 shadow-none transition-all duration-300
            hover:shadow-lg hover:border-border hover:-translate-y-0.5
            before:absolute before:inset-0 before:rounded-[inherit]
            before:pointer-events-none
            dark:before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_55%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]
          "
        >
          <CardHeader className="py-3 space-y-0">
            {/* Header with icon and label */}
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex items-center gap-3">
                <div className="bg-muted/50 rounded-xl p-2 transition-transform duration-300 group-hover:scale-110">
                  <div className="text-muted-foreground">
                    {card.icon}
                  </div>
                </div>
                <CardDescription className="text-sm font-semibold text-muted-foreground/80 tracking-wide uppercase">
                  {card.label}
                </CardDescription>
              </div>
            </div>

            {/* Main value */}
            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tabular-nums text-[#40221a] dark:text-white tracking-tight">
                {card.value}
              </CardTitle>

              {/* Delta indicator for Income/Expenses (not for Balance since it's static) */}
              {(card.kind === "income" || card.kind === "expenses") && (() => {
                const d = Number(card.delta || 0)
                const ad = Math.abs(d)
                const disp = `${isFinite(ad) ? ad.toFixed(1) : "0.0"}%`
                const isZero = Math.round(d * 10) === 0
                const isPos = d > 0
                const isExpenses = card.kind === "expenses"
                const color = isZero
                  ? "text-muted-foreground/60"
                  : isExpenses
                    ? (isPos ? "text-[#40221a] dark:text-white" : "text-[#40221a] dark:text-white")
                    : (isPos ? "text-[#40221a] dark:text-white" : "text-[#40221a] dark:text-white")
                const bgColor = isZero
                  ? "bg-muted/50"
                  : "bg-[#40221a]/10 dark:bg-white/10"
                return (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgColor} transition-colors duration-300`}>
                    {!isZero &&
                      (isPos ? (
                        <IconArrowUpRight className={`size-3.5 ${color}`} strokeWidth={2.5} />
                      ) : (
                        <IconArrowDownRight className={`size-3.5 ${color}`} strokeWidth={2.5} />
                      ))}
                    <span className={`text-xs font-bold ${color}`}>{disp}</span>
                    <span className="text-xs text-muted-foreground/60">vs prev</span>
                  </div>
                )
              })()}

              {/* Goal and Progress for Balance/Savings */}
              {(card.kind === "balance" || card.kind === "savings") && (
                <div className="space-y-1.5 pt-0.5">
                  {/* Progress bar */}
                  <div className="relative">
                    <Progress value={card.progress} className="h-1 bg-muted" />
                    {card.progress >= 100 && (
                      <div className="absolute -top-1 right-0 flex items-center justify-center w-4 h-4 bg-[#40221a] dark:bg-white rounded-full animate-bounce">
                        <svg className="w-2.5 h-2.5 text-white dark:text-[#40221a]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Goal input */}
                  <div 
                    className="flex items-center gap-2 text-xs group/goal cursor-pointer"
                    onClick={() => setEditingGoal(card.kind)}
                  >
                    <IconTarget className="size-3.5 text-muted-foreground/60" />
                    <span className="text-muted-foreground/60 font-medium">Goal:</span>
                    {editingGoal === card.kind ? (
                      <Input
                        autoFocus
                        inputMode="decimal"
                        className="h-6 w-20 text-xs px-2 border-muted-foreground/20"
                        value={card.kind === "balance" ? balanceGoalInDisplayCurrency || '' : savingsRateGoal || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          if (card.kind === "balance") {
                            // Convert from display currency back to EUR for storage
                            const convertedToEUR = convertAmount(val, baseCurrency, 'EUR')
                            setBalanceGoal(convertedToEUR)
                          } else {
                            setSavingsRateGoal(val)
                          }
                          setHasUserEdited(true)
                        }}
                        onBlur={() => {
                          setEditingGoal(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingGoal(null)
                        }}
                      />
                    ) : (
                      <span className="font-semibold text-foreground/90 group-hover/goal:text-foreground transition-colors">
                        {card.kind === "balance" 
                          ? formatCurrency(card.goal || 0, baseCurrency)
                          : `${card.goal}%`
                        }
                      </span>
                    )}
                    <span className="text-muted-foreground/70 text-[10px] opacity-100 group-hover/goal:opacity-100 transition-opacity">
                      ({card.progress?.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>

          {/* Subtle accent gradient at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#40221a]/10 to-[#40221a]/5 dark:from-white/10 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Card>
      ))}
    </div>
  )
}