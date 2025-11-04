"use client"

import React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAccounts, getAuthHeader } from "@/lib/api"
import { useCurrency } from "@/contexts/currency-context"
import { DateRangeProvider } from "@/contexts/date-range-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Banknote, Building2, RefreshCw, AlertCircle, Plus } from "lucide-react"
import { Gauge } from '@mui/x-charts/Gauge'
import { BudgetSettingsCard } from "@/components/dashboard/budget-settings-card"
import { useQueries } from "@tanstack/react-query"
import { formatBankName } from "@/lib/bank-name-mapping"
import { PaymentWall } from "@/components/payment/payment-wall"
import { usePremiumStatus } from "@/components/payment/checkout-button"

type BankAccountDoc = {
  $id: string
  accountId?: string
  institutionId?: string
  institutionName?: string
  accountName?: string
  currency?: string
  status?: string
  iban?: string | null
  logoUrl?: string | null
  maxAccessValidforDays?: number | null
  connectionCreatedAt?: string | null
}

// Test toggle: simulate expired access by default in dev when enabled
// To test, set NEXT_PUBLIC_SIMULATE_EXPIRED=1 in .env.local or append ?simulateExpired=1

function maskIban(iban?: string | null): string {
  if (!iban) return ""
  const clean = iban.replace(/\s+/g, "")
  if (clean.length <= 8) return clean
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function AccessGauge({ remainingDays, maxDays }: { remainingDays: number; maxDays: number }) {
  const pctRemaining = Math.max(0, Math.min(100, Math.round((remainingDays / maxDays) * 100)))

  // Color based on remaining percentage
  const getColor = (pct: number) => {
    if (pct > 60) return "#10b981" // green
    if (pct > 30) return "#f59e0b" // amber
    return "#ef4444" // red
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 cursor-help">
            <div className="w-12 h-12">
              <Gauge
                value={pctRemaining}
                startAngle={90}
                endAngle={-270}
                innerRadius="80%"
                outerRadius="100%"
                cornerRadius={4}
                color={getColor(pctRemaining)}
                sx={{
                  [`& .MuiGauge-valueText`]: {
                    display: 'none'
                  },
                  [`& .MuiGauge-referenceArc`]: {
                    fill: '#e5e7eb'
                  }
                }}
              />
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {remainingDays}d
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {remainingDays} days of validity remaining on your bank connection
          </p>
          {remainingDays <= 7 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Renew soon to avoid interruption
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AccountCard({ account, forceExpired, groupAccountIds }: { account: BankAccountDoc; forceExpired?: boolean; groupAccountIds?: string[] }) {
  const id = account.accountId || account.$id
  const idsToFetch = (Array.isArray(groupAccountIds) && groupAccountIds.length > 0) ? groupAccountIds : [id]

  const detailQueries = useQueries({
    queries: idsToFetch.map((accountId) => ({
      queryKey: ["account-details", accountId],
      queryFn: async () => {
        const headers = await getAuthHeader()
        const res = await fetch(`/api/accounts/${accountId}`, {
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          credentials: "include",
        })
        if (!res.ok) {
          throw new Error(`API Error: ${res.status}`)
        }
        return res.json()
      },
      staleTime: 60 * 1000,
    }))
  })
  const isLoading = detailQueries.some((q) => q.isLoading)
  const isFetching = detailQueries.some((q) => q.isFetching)
  const hasData = detailQueries.some((q) => !!q.data)
  const isError = !isLoading && !hasData
  const refetchAll = () => detailQueries.forEach((q) => q.refetch())
  const { formatAmount, convertAmount, baseCurrency } = useCurrency()

  // Compute access validity
  const createdAt = account.connectionCreatedAt ? new Date(account.connectionCreatedAt) : null
  const maxDays = account.maxAccessValidforDays ?? null
  const lastValidDate = createdAt && maxDays ? new Date(createdAt.getTime() + maxDays * 24 * 60 * 60 * 1000) : null
  const today = new Date()
  const remainingDays = lastValidDate ? Math.max(0, Math.ceil((lastValidDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))) : null

  if (isLoading) {
    return (
      <Card className="group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-black border border-gray-200 dark:border-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/20">
                <Building2 className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <Skeleton className="h-5 w-32 mb-2 rounded-lg" />
                <Skeleton className="h-3 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-black border border-gray-200 dark:border-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-gray-800 dark:text-white">
                  {account.accountName || account.institutionName || "Bank account"}
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400">Failed to load balance</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAll()}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </CardHeader>
      </Card>
    )
  }

  const details = detailQueries.map((q) => q.data).filter(Boolean) as any[]
  const perAccountAmounts = details.map((d) => {
    const arr: any[] = Array.isArray((d as any)?.balances?.balances) ? (d as any).balances.balances : []
    const closing = arr.find((b) => (b.balanceType || "").toLowerCase() === "closingbooked")
    const primary = closing || arr[0]
    const amt = Number(primary?.balanceAmount?.amount ?? 0)
    const cur = String(primary?.balanceAmount?.currency || account.currency || "EUR")
    return { amount: amt, currency: cur }
  })

  const uniqueCurrencies = new Set(perAccountAmounts.map((x) => x.currency.toUpperCase()))
  const totalBaseAmount = perAccountAmounts.reduce((sum, x) => sum + convertAmount(x.amount, x.currency, baseCurrency), 0)

  const nativeCurrency = uniqueCurrencies.size === 1 ? perAccountAmounts[0]?.currency || account.currency || "EUR" : baseCurrency
  const nativeAmount = uniqueCurrencies.size === 1
    ? perAccountAmounts.reduce((sum, x) => sum + x.amount, 0)
    : totalBaseAmount
  const baseAmount = convertAmount(nativeAmount, nativeCurrency, baseCurrency)

  const isActive = account.status === "active"
  const isExpiredAccess = Boolean(forceExpired) || (account.maxAccessValidforDays === 0) || (remainingDays !== null && remainingDays <= 0)

  return (
    <Card className="group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-black border border-gray-200 dark:border-white">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {account.logoUrl ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/20 flex items-center justify-center">
                <img
                  src={account.logoUrl}
                  alt={formatBankName(account.institutionId)}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/20">
                <Banknote className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg font-bold text-gray-800 dark:text-white truncate mb-1">
                 {account.accountName || formatBankName(account.institutionId) || "Bank account"} 
              {/* {account.institutionId} */}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`w-fit text-[11px] font-semibold px-3 py-1 rounded-full border-0 shadow-sm ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300'
                    : 'bg-gray-500/20 text-gray-700 dark:bg-gray-400/20 dark:text-gray-300'
                }`}>
                  {capitalizeFirst(account.status || "active")}
                </Badge>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {maskIban(account.iban)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {remainingDays !== null && maxDays ? (
              <AccessGauge remainingDays={remainingDays} maxDays={maxDays} />
            ) : (
              <div className="text-xs text-gray-400 dark:text-gray-500">No access info</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <div className="text-3xl font-bold text-gray-800 dark:text-white leading-tight mb-1">
              {formatAmount(nativeAmount, nativeCurrency)}
            </div>
            {nativeCurrency.toUpperCase() !== baseCurrency?.toUpperCase() && (
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                ≈ {formatAmount(baseAmount)}
              </div>
            )}
          </div>

          {isExpiredAccess && (
            <Link
              href={{
                pathname: "/link-bank",
                query: {
                  institutionId: account.institutionId || "",
                  institutionName: formatBankName(account.institutionId) || account.accountName || "",
                  autoConnect: "1",
                },
              }}
            >
              <Button
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 rounded-full"
                type="button"
              >
                Renew Access
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function BanksPage() {
  const { data: accounts, isLoading } = useAccounts()
  const searchParams = useSearchParams()
  const simulateExpired = (process.env.NEXT_PUBLIC_SIMULATE_EXPIRED === '1') || (searchParams?.get('simulateExpired') === '1')
  const { isPremium, isLoading: premiumLoading } = usePremiumStatus()

  const grouped = React.useMemo(() => {
    if (!Array.isArray(accounts)) return [] as { representative: BankAccountDoc; ids: string[] }[]
    const map = new Map<string, { representative: BankAccountDoc; ids: string[] }>()
    for (const acc of (accounts as BankAccountDoc[])) {
      const key = acc.institutionId || `acc:${acc.$id}`
      const id = acc.accountId || acc.$id
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { representative: acc, ids: [id] })
      } else {
        if (!existing.ids.includes(id)) existing.ids.push(id)
      }
    }
    return Array.from(map.values())
  }, [accounts])

  return (
    <AuthGuard requireAuth={true}>
      <DateRangeProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-5 py-5 md:gap-6 md:py-6">
                  <div className="px-4 lg:px-6">

                    {/* Premium Wall for non-premium users */}
                    {!premiumLoading && !isPremium && (
                      <div className="mb-8">
                        <PaymentWall
                          title="Connect Your Banks"
                          description="Premium users can connect unlimited bank accounts and access real-time financial insights."
                          feature="Bank Connections"
                          ctaText="Upgrade to Connect Banks"
                          redirectTo="/banks"
                        />
                      </div>
                    )}

                    {/* Header Section - Only show for premium users */}
                    {(!premiumLoading && isPremium) && (
                      <div className="flex items-center justify-end mb-4">
                        <Link href="/link-bank" className="inline-flex">
                          <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-200 px-5 py-2.5 text-sm">
                            <Plus className="h-4 w-4" />
                            Connect Bank
                          </Button>
                        </Link>
                      </div>
                    )}

                  {/* Content - Only show for premium users */}
                  {(!premiumLoading && isPremium) && (
                    <>
                      {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="group transition-all duration-300 bg-white dark:bg-black border border-gray-200 dark:border-white">
                              <CardHeader className="pb-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/20"></div>
                                  <div className="flex-1">
                                    <Skeleton className="h-6 w-40 mb-2 rounded-lg" />
                                    <Skeleton className="h-4 w-24 rounded-lg" />
                                  </div>
                                  <div className="w-8 h-8">
                                    <Skeleton className="w-full h-full rounded-full" />
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="flex items-end justify-between">
                                  <div>
                                    <Skeleton className="h-10 w-32 mb-2 rounded-lg" />
                                    <Skeleton className="h-5 w-20 rounded-lg" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : Array.isArray(accounts) && accounts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {grouped.map(({ representative, ids }) => (
                            <AccountCard
                              key={representative.institutionId || representative.$id}
                              account={representative}
                              groupAccountIds={ids}
                              forceExpired={Boolean(simulateExpired)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center min-h-[400px]">
                          <Card className="max-w-md w-full bg-white dark:bg-black border border-gray-200 dark:border-white shadow-xl">
                            <CardHeader className="text-center pb-6">
                              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/20">
                                <Building2 className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                              </div>
                              <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
                                No Banks Connected
                              </CardTitle>
                              <CardDescription className="text-gray-600 dark:text-gray-300 text-base">
                                Connect your first bank account to start tracking your finances
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                              <Link href="/link-bank" className="inline-flex">
                                <Button className="gap-3 shadow-lg hover:shadow-xl transition-all duration-300 px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 rounded-full text-base font-semibold">
                                  <Plus className="h-5 w-5" />
                                  Connect Your First Bank
                                </Button>
                              </Link>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Budget Settings Section */}
                <div className="px-4 lg:px-6">
                  <div className="w-full">
                    <BudgetSettingsCard />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      </DateRangeProvider>
    </AuthGuard>
  )
}