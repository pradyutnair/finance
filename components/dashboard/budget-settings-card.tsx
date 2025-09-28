"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wallet, Save, RefreshCw, AlertCircle, ShoppingCart, Utensils, Car, Plane, ShoppingBag, Zap, Gamepad2, Heart, MoreHorizontal } from "lucide-react"
import { getCategoryColor } from "@/lib/categories"
import { account } from "@/lib/appwrite"

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
  { key: 'restaurantsBudget', label: 'Restaurants', categoryName: 'Restaurant' },
  { key: 'transportBudget', label: 'Transport', categoryName: 'Transport' },
  { key: 'travelBudget', label: 'Travel', categoryName: 'Travel' },
  { key: 'shoppingBudget', label: 'Shopping', categoryName: 'Shopping' },
  { key: 'utilitiesBudget', label: 'Utilities', categoryName: 'Utilities' },
  { key: 'entertainmentBudget', label: 'Entertainment', categoryName: 'Entertainment' },
  { key: 'healthBudget', label: 'Health', categoryName: 'Health' },
  { key: 'miscellaneousBudget', label: 'Miscellaneous', categoryName: 'Miscellaneous' },
]

export function BudgetSettingsCard() {
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

  // budgets are saved server-side for the authenticated user

  useEffect(() => {
    refreshAll()
  }, [])

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
    await Promise.all([fetchBudgets(), fetchCategorySpend()])
  }

  const fetchBudgets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/budgets', { headers: await authHeaders() })
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setBudgetData(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch budgets:', error)
      setError('Failed to load budget data')
    } finally {
      setIsLoading(false)
    }
  }

  const fmtDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const fetchCategorySpend = async () => {
    try {
      setIsLoadingSpend(true)
      const today = new Date()
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      const to = today
      const resp = await fetch(`/api/categories?from=${fmtDate(from)}&to=${fmtDate(to)}`, { headers: await authHeaders() })
      if (resp.ok) {
        const data: Array<{ name: string; amount: number }> = await resp.json()
        const map: Record<string, number> = {}
        for (const row of data) {
          map[row.name] = row.amount || 0
        }
        setCategorySpend(map)
      }
    } catch (e) {
      // ignore soft-fail
    } finally {
      setIsLoadingSpend(false)
    }
  }

  const saveBudgets = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          ...budgetData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save budgets')
      }

      // Refresh spend after save
      await fetchBudgets()
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
  }

  const totalBudget = Object.entries(budgetData)
    .filter(([key, value]) => key.endsWith('Budget') && typeof value === 'number')
    .reduce((sum, [, value]) => sum + (value as number), 0)

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
          <Badge variant="secondary" className="text-sm">
            Total: {budgetData.baseCurrency} {totalBudget.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetCategories.map((category) => {
            const key = category.key as keyof BudgetData
            const total = (budgetData[key] as number) || 0
            const spent = categorySpend[category.categoryName] || 0
            const pct = total > 0 ? Math.min(100, Math.max(0, (spent / total) * 100)) : 0
            const color = getCategoryColor(category.categoryName)
            const Icon = (
              category.categoryName === 'Groceries' ? ShoppingCart :
              category.categoryName === 'Restaurant' ? Utensils :
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
                        {isLoadingSpend ? '…' : `${budgetData.baseCurrency} ${spent.toFixed(2)}`}
                      </span>
                      <span className="opacity-50">/</span>
                      <input
                        inputMode="decimal"
                        className="w-24 sm:w-28 rounded-md border bg-transparent px-2 py-1 text-right text-xs sm:text-sm"
                        value={Number.isFinite(total) ? String(total) : ''}
                        onChange={(e) => updateBudget(category.key as keyof BudgetData, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full rounded bg-muted overflow-hidden">
                    <div
                      className="h-2 rounded"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
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
              value={budgetData.baseCurrency || 'EUR'}
              onChange={(e) => setBudgetData(prev => ({ ...prev, baseCurrency: e.target.value.toUpperCase() }))}
              className="w-20 text-center"
              maxLength={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBudgets}
              disabled={isSaving}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={saveBudgets}
              disabled={isSaving}
              className="min-w-[100px]"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Budgets
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
