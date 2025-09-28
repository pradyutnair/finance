"use client"

import React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAccounts, useAccountDetails } from "@/lib/api"
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
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

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

  const chartData = [{ value: pctRemaining }]
  const color = getColor(pctRemaining)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative w-28 h-28 cursor-help">
            <ChartContainer
              config={{ value: { color } }}
              className="w-full h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="95%"
                  startAngle={90}
                  endAngle={-270}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={5}
                    fill={color}
                    background={{ fill: "#e5e7eb" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </ChartContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[12px] font-semibold leading-none">{remainingDays}</div>
              <div className="text-[10px] opacity-60 leading-none mt-0.5">days</div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{remainingDays} days remaining until access to the bank needs to be renewed</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function AccountCard({ account, forceExpired }: { account: BankAccountDoc; forceExpired?: boolean }) {
  const id = account.accountId || account.$id
  const { data, isLoading, isError, refetch, isFetching } = useAccountDetails(id)
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

  if (isError || !data) {
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
              onClick={() => refetch()} 
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

  const balancesArray: any[] = Array.isArray((data as any)?.balances?.balances)
    ? (data as any).balances.balances
    : []
  const closing = balancesArray.find((b) => (b.balanceType || "").toLowerCase() === "closingbooked")
  const primary = closing || balancesArray[0]
  const nativeAmount = Number(primary?.balanceAmount?.amount ?? 0)
  const nativeCurrency = String(primary?.balanceAmount?.currency || account.currency || "EUR")
  const baseAmount = convertAmount(nativeAmount, nativeCurrency, baseCurrency)

  const isActive = account.status === "active"
  const isExpiredAccess = Boolean(forceExpired) || (account.maxAccessValidforDays === 0) || (remainingDays !== null && remainingDays <= 0)

  return (
    <Card className="group transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 py-4">
      <CardHeader className="relative pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {account.logoUrl ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden shadow-sm border">
                <img
                  src={account.logoUrl}
                  alt={account.institutionName || "Bank"}
                  className="w-full h-full object-contain p-1"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                <Banknote className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold truncate">
                {account.accountName || account.institutionName || "Bank account"}
              </CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
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

          <div className="flex items-center gap-3 flex-shrink-0 ml-6">
            {remainingDays !== null && maxDays ? (
              <AccessGauge remainingDays={remainingDays} maxDays={maxDays} />
            ) : (
              <div className="text-xs opacity-50">Access info unavailable</div>
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
                  institutionName: account.institutionName || account.accountName || "",
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
            <Button
              variant="outline"
              className="ml-4 px-3 py-1.5 text-xs font-semibold dark:hover:text-red-600"
              type="button"
            >
              Revoke Access
            </Button>
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

  return (
    <AuthGuard requireAuth={true}>
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
                      {(accounts as BankAccountDoc[]).map((acc) => (
                        <AccountCard key={acc.$id} account={acc} forceExpired={Boolean(simulateExpired)} />
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
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  )
}