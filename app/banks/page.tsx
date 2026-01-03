"use client"

import React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAccounts, getAuthHeader } from "@/lib/api"
import { useCurrency } from "@/contexts/currency-context"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Banknote, Building2, RefreshCw, AlertCircle, Plus } from "lucide-react"
import { BudgetSettingsCard } from "@/components/dashboard/budget-settings-card"
import { useQueries } from "@tanstack/react-query"
import { formatBankName } from "@/lib/bank-name-mapping"
import { DateRangeProvider } from "@/contexts/date-range-context"

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

function AccessIndicator({ remainingDays, maxDays }: { remainingDays: number; maxDays: number }) {
  const pctRemaining = Math.max(0, Math.min(100, Math.round((remainingDays / maxDays) * 100)))
  
  // Color based on remaining percentage
  const getBadgeClasses = (pct: number) => {
    if (pct > 60) return "bg-emerald-100 text-emerald-700 border-emerald-200"
    if (pct > 30) return "bg-amber-100 text-amber-700 border-amber-200"
    return "bg-red-100 text-red-700 border-red-200"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`text-[10px] font-medium px-2 py-0.5 h-5 ${getBadgeClasses(pctRemaining)} border shrink-0 cursor-help`}
          >
            {remainingDays}d
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {remainingDays} of {maxDays} days remaining until access needs to be renewed
          </p>
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
      <Card className="group transition-all duration-200 hover:shadow-lg py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-6 w-14" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="group transition-all duration-200 hover:shadow-lg py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {account.accountName || account.institutionName || "Bank account"}
                </CardTitle>
                <CardDescription>Failed to load balance</CardDescription>
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
    <Card className="group transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 py-4">
      <CardHeader className="relative pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {account.logoUrl ? (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md shadow-sm overflow-hidden bg-white shrink-0">
                <img
                  src={account.logoUrl}
                  alt={formatBankName(account.institutionId)}
                  className="w-full h-full object-contain p-1"
                />
              </div>
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-semibold truncate">
                {account.accountName || formatBankName(account.institutionId) || "Bank account"}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`w-fit text-[10px] font-medium px-2 py-0.5 ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {capitalizeFirst(account.status || "active")}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center sm:items-start justify-end sm:justify-start shrink-0">
            {remainingDays !== null && maxDays ? (
              <AccessIndicator remainingDays={remainingDays} maxDays={maxDays} />
            ) : (
              <div className="text-[10px] opacity-50 whitespace-nowrap">Access info unavailable</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex items-start justify-between pt-2 border-t">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            <div className="flex flex-col items-start min-w-[110px]">
              <div className="text-2xl font-bold leading-tight">
                {formatAmount(nativeAmount, nativeCurrency)}
              </div>
              {nativeCurrency.toUpperCase() !== baseCurrency?.toUpperCase() && (
                <div className="text-xs opacity-70 mt-0.5">
                  {formatAmount(baseAmount)}
                </div>
              )}
            </div>
            <div className="text-xs font-medium opacity-70 sm:ml-4 ml-0">
              {maskIban(account.iban)}
            </div>
          </div>
          {isExpiredAccess ? (
            <Link
              href={{
                pathname: "/link-bank",
                query: {
                  institutionId: account.institutionId || "",
                    institutionName: formatBankName(account.institutionId) || account.accountName || "",
                  autoConnect: "1",
                },
              }}
              className="ml-4"
            >
              <Button
                className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shadow-md hover:opacity-90"
                type="button"
              >
                Renew Access
              </Button>
            </Link>
          ) : (
            // Do nothing
            <div></div> 

            // <Button
            //   variant="outline"
            //   className="ml-4 px-3 py-1.5 text-xs font-semibold dark:hover:text-red-600"
            //   type="button"
            // >
            //   Revoke Access
            // </Button>
          //</CardContent>)}
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
                  {/* Header Section */}
                  <div className="flex items-center justify-end mb-4">
                    <Link href="/link-bank" className="inline-flex">
                      <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-200 px-5 py-2.5 text-sm">
                        <Plus className="h-4 w-4" />
                        Connect Bank
                      </Button>
                    </Link>
                  </div>

                  {/* Content */}
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i} className="py-4">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-3">
                              <Skeleton className="w-10 h-10 rounded-lg" />
                              <div className="flex-1">
                                <Skeleton className="h-4 w-32 mb-2" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-3.5 w-32" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : Array.isArray(accounts) && accounts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      <Card className="max-w-md w-full shadow-lg">
                        <CardHeader className="text-center pb-4">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center">
                            <Building2 className="w-8 h-8" />
                          </div>
                          <CardTitle className="text-xl font-semibold">
                            No Banks Connected
                          </CardTitle>
                          <CardDescription>
                            Connect your first bank account to start tracking your finances
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                          <Link href="/link-bank" className="inline-flex">
                            <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-3">
                              <Plus className="h-4 w-4" />
                              Connect Your First Bank
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>
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