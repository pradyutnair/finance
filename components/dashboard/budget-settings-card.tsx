"use client"

import React, { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LiquidProgress } from "./liquid-progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wallet, Save, RefreshCw, AlertCircle, ShoppingCart, Utensils, Car, Plane, ShoppingBag, Zap, Gamepad2, Heart, MoreHorizontal, Check } from "lucide-react"
import { getCategoryColor } from "@/lib/categories"
import { account } from "@/lib/appwrite"
import { useDateRange } from "@/contexts/date-range-context"
import { useCurrency } from "@/contexts/currency-context"

interface BudgetCategory { key: string; label: string; categoryName: string }

interface BudgetData {
  $id?: string
  baseCurrency: string
  groceriesBudget: number
  restaurantsBudget: number
  transportBudget: number
  travelBudget: number
  shoppingBudget: number
  utilitiesBudget: number
  entertainmentBudget: number
  healthBudget: number
  miscellaneousBudget: number
}

const budgetCategories: BudgetCategory[] = [
  { key: 'groceriesBudget', label: 'Groceries', categoryName: 'Groceries' },
  { key: 'restaurantsBudget', label: 'Restaurants', categoryName: 'Restaurants' },
  { key: 'transportBudget', label: 'Transport', categoryName: 'Transport' },
  { key: 'travelBudget', label: 'Travel', categoryName: 'Travel' },
  { key: 'shoppingBudget', label: 'Shopping', categoryName: 'Shopping' },
  { key: 'utilitiesBudget', label: 'Utilities', categoryName: 'Utilities' },
  { key: 'entertainmentBudget', label: 'Entertainment', categoryName: 'Entertainment' },
  { key: 'healthBudget', label: 'Health', categoryName: 'Health' },
  { key: 'miscellaneousBudget', label: 'Miscellaneous', categoryName: 'Miscellaneous' },
]

export function BudgetSettingsCard() {
  const { dateRange } = useDateRange()
  const { formatAmount, baseCurrency: displayCurrency } = useCurrency()
  const [budgetData, setBudgetData] = useState<Partial<BudgetData>>({
    baseCurrency: 'EUR',
    groceriesBudget: 0,
    restaurantsBudget: 0,
    transportBudget: 0,
    travelBudget: 0,
    shoppingBudget: 0,
    utilitiesBudget: 0,
    entertainmentBudget: 0,
    healthBudget: 0,
    miscellaneousBudget: 0,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categorySpend, setCategorySpend] = useState<Record<string, number>>({})
  const [isLoadingSpend, setIsLoadingSpend] = useState(true)
  const [jwt, setJwt] = useState<string | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false)
  const [savePending, setSavePending] = useState(false)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const budgetRef = React.useRef<Partial<BudgetData>>(budgetData)
  const didInitRef = useRef(false)

  // budgets are saved server-side for the authenticated user

  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true

    const run = async () => {
      let usedCache = false
      try {
        const cached = sessionStorage.getItem('budgetPrefs')
        if (cached) {
          const data = JSON.parse(cached)
          setBudgetData(data)
          setIsLoading(false)
          setAutoSaveEnabled(true)
          usedCache = true
        }
      } catch {}

      // Always refresh category spend; fetch budgets only if no cache
      await Promise.all([
        usedCache ? Promise.resolve() : fetchBudgets(),
        fetchCategorySpend(),
      ])
    }

    run()
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // Re-fetch category spend when date range changes
  useEffect(() => {
    if (didInitRef.current) {
      fetchCategorySpend(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  useEffect(() => {
    budgetRef.current = budgetData
  }, [budgetData])

  const authHeaders = async (): Promise<HeadersInit> => {
    // Try to use a short-lived Appwrite JWT for server verification
    try {
      const token = jwt || (await account.createJWT()).jwt
      if (!jwt) setJwt(token)
      return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    } catch {
      // Fallback: allow cookie-only if present
      return { 'Content-Type': 'application/json' }
    }
  }

  const refreshAll = async () => {
    // Clear sessionStorage cache for category spend
    try {
      const today = new Date()
      const from = dateRange?.from || new Date(today.getFullYear(), today.getMonth(), 1)
      const to = dateRange?.to || today
      const cacheKey = `categorySpend:${fmtDate(from)}:${fmtDate(to)}`
      sessionStorage.removeItem(cacheKey)
    } catch {}
    
    await Promise.all([fetchBudgets(), fetchCategorySpend(true)])
  }

  const fetchBudgets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/budgets', { headers: await authHeaders() })
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setBudgetData(data)
          try { sessionStorage.setItem('budgetPrefs', JSON.stringify(data)) } catch {}
        }
      }
    } catch (error) {
      console.error('Failed to fetch budgets:', error)
      setError('Failed to load budget data')
    } finally {
      setIsLoading(false)
      setAutoSaveEnabled(true)
    }
  }

  const fmtDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getLiquidProgressClass = (categoryName: string) => {
    const className = categoryName.toLowerCase()
    return `liquid-progress-${className}`
  }

  const fetchCategorySpend = async (skipCache = false) => {
    try {
      setIsLoadingSpend(true)
      // Use date range from context if available, otherwise default to current month
      const today = new Date()
      const from = dateRange?.from || new Date(today.getFullYear(), today.getMonth(), 1)
      const to = dateRange?.to || today
      const cacheKey = `categorySpend:${fmtDate(from)}:${fmtDate(to)}`
      
      // Use cache only if not skipping
      if (!skipCache) {
        try {
          const cached = sessionStorage.getItem(cacheKey)
          if (cached) {
            setCategorySpend(JSON.parse(cached))
            setIsLoadingSpend(false)
            return
          }
        } catch {}
      }

      // Add refresh parameter to bust server-side cache
      const url = `/api/categories?from=${fmtDate(from)}&to=${fmtDate(to)}${skipCache ? '&refresh=true' : ''}`
      const resp = await fetch(url, { headers: await authHeaders() })
      if (resp.ok) {
        const data: Array<{ name: string; amount: number }> = await resp.json()
        const map: Record<string, number> = {}
        for (const row of data) {
          map[row.name] = row.amount || 0
        }
        setCategorySpend(map)
        try { sessionStorage.setItem(cacheKey, JSON.stringify(map)) } catch {}
      }
    } catch (e) {
      // ignore soft-fail
    } finally {
      setIsLoadingSpend(false)
    }
  }

  const saveBudgets = async (payload?: Partial<BudgetData>) => {
    try {
      setIsSaving(true)
      setSavingState('saving')
      setError(null)

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          ...(payload ?? budgetRef.current),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save budgets')
      }

      setSavingState('saved')
      setTimeout(() => setSavingState('idle'), 5500)
      try {
        const cached = sessionStorage.getItem('budgetPrefs')
        const prev = cached ? JSON.parse(cached) : {}
        const merged = { ...prev, ...(payload ?? budgetRef.current) }
        sessionStorage.setItem('budgetPrefs', JSON.stringify(merged))
      } catch {}
    } catch (error) {
      console.error('Failed to save budgets:', error)
      setError('Failed to save budget data')
    } finally {
      setIsSaving(false)
    }
  }

  const updateBudget = (key: keyof BudgetData, value: number) => {
    setBudgetData(prev => ({
      ...prev,
      [key]: value,
    }))
    if (autoSaveEnabled) {
      setSavePending(true)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSavePending(false)
        await saveBudgets(budgetRef.current)
      }, 5000)
    }
  }

  const totalBudget = Object.entries(budgetData)
    .filter(([key, value]) => key.endsWith('Budget') && typeof value === 'number')
    .reduce((sum, [, value]) => sum + (value as number), 0)
  const totalSpent = Object.values(categorySpend).reduce((sum, v) => sum + (v || 0), 0)
  const totalPct = totalBudget > 0 ? Math.min(100, Math.max(0, (totalSpent / totalBudget) * 100)) : 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Budget Settings
          </CardTitle>
          <CardDescription>Loading your budget preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Budget Settings
            </CardTitle>
            <CardDescription>
              Set your monthly spending limits for different categories
            </CardDescription>
          </div>
          <div className="flex items-right justify-end">
            {savingState === 'saving' && (
              <RefreshCw className="w-4 h-4 animate-spin" />
            )}
            {savingState === 'saved' && (
              <Check className="w-4 h-4 text-emerald-500" />
            )}
            {/* <Badge variant="secondary" className="text-sm">
              Total: {budgetData.baseCurrency} {totalBudget.toFixed(2)}
            </Badge> */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Overall progress */}
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-medium">Overall</span>
            <span className="font-mono">
              {formatAmount(totalSpent)} / {formatAmount(totalBudget)}
            </span>
          </div>
          <LiquidProgress
            className="mt-2 h-2 w-full rounded bg-muted"
            gradientClass="liquid-progress-overall dark:liquid-progress-overall-dark"
            value={totalPct}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetCategories.map((category) => {
            const key = category.key as keyof BudgetData
            const total = (budgetData[key] as number) || 0
            const spent = categorySpend[category.categoryName] || 0
            const pct = total > 0 ? Math.min(100, Math.max(0, (spent / total) * 100)) : 0
            const color = getCategoryColor(category.categoryName)
            const Icon = (
              category.categoryName === 'Groceries' ? ShoppingCart :
              category.categoryName === 'Restaurants' ? Utensils :
              category.categoryName === 'Transport' ? Car :
              category.categoryName === 'Travel' ? Plane :
              category.categoryName === 'Shopping' ? ShoppingBag :
              category.categoryName === 'Utilities' ? Zap :
              category.categoryName === 'Entertainment' ? Gamepad2 :
              category.categoryName === 'Health' ? Heart :
              MoreHorizontal
            )

            return (
              <div key={category.key} className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span>{category.label}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs sm:text-sm">
                      <span className="font-mono">
                        {isLoadingSpend ? '…' : formatAmount(spent)}
                      </span>
                      <span className="opacity-50">/</span>
                      <input
                        inputMode="decimal"
                        className="w-24 sm:w-28 rounded-md border bg-transparent px-2 py-1 text-right text-xs sm:text-sm font-mono"
                        value={Number.isFinite(total) ? String(total) : ''}
                        onChange={(e) => updateBudget(category.key as keyof BudgetData, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <LiquidProgress
                    className="h-2 w-full rounded bg-muted"
                    gradientClass={getLiquidProgressClass(category.categoryName)}
                    value={pct}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label htmlFor="baseCurrency" className="text-sm font-medium">
              Base Currency
            </Label>
            <Input
              id="baseCurrency"
              value={budgetData.baseCurrency || displayCurrency}
              onChange={(e) => setBudgetData(prev => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
              className="w-20 text-center"
              maxLength={3}
            />
          </div>

          <div className="flex gap-2 ">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              disabled={isSaving || isLoadingSpend}
              className="hover:bg-chart-1/80"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || isLoadingSpend ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
