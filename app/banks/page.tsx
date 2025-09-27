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
import Link from "next/link"
import { Banknote, Building2, ArrowRight, RefreshCw, AlertCircle } from "lucide-react"

type BankAccountDoc = {
  $id: string
  accountId?: string
  institutionName?: string
  accountName?: string
  currency?: string
  status?: string
  iban?: string | null
}

function maskIban(iban?: string | null): string {
  if (!iban) return ""
  const clean = iban.replace(/\s+/g, "")
  if (clean.length <= 8) return clean
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`
}

function AccountCard({ account }: { account: BankAccountDoc }) {
  const id = account.accountId || account.$id
  const { data, isLoading, isError, refetch, isFetching } = useAccountDetails(id)
  const { formatAmount, convertAmount, baseCurrency } = useCurrency()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Loading account…</CardTitle>
                <CardDescription>Fetching balances</CardDescription>
              </div>
            </div>
            <Skeleton className="h-6 w-28" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">{account.accountName || account.institutionName || "Bank account"}</CardTitle>
                <CardDescription>Failed to load balance</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">{account.accountName || account.institutionName || "Bank account"}</CardTitle>
              <CardDescription>{account.institutionName}</CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">{formatAmount(nativeAmount, nativeCurrency)}</div>
            {nativeCurrency.toUpperCase() !== baseCurrency?.toUpperCase() ? (
              <div className="text-xs text-muted-foreground">{formatAmount(baseAmount)}</div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {maskIban(account.iban)}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={account.status === "active" ? "default" : "secondary"}>
              {account.status || "active"}
            </Badge>
            <Link href={`/transactions?accountId=${encodeURIComponent(id)}`} className="inline-flex">
              <Button variant="ghost" size="sm" className="gap-1">
                View activity
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BanksPage() {
  const { data: accounts, isLoading } = useAccounts()

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
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  <div className="flex items-center justify-between mb-2">
                    
                    <Link href="/link-bank" className="inline-flex">
                      <Button>Connect bank</Button>
                    </Link>
                  </div>

                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-lg" />
                                <div>
                                  <Skeleton className="h-5 w-36 mb-2" />
                                  <Skeleton className="h-3 w-24" />
                                </div>
                              </div>
                              <Skeleton className="h-6 w-24" />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-4 w-40" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : Array.isArray(accounts) && accounts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(accounts as BankAccountDoc[]).map((acc) => (
                        <AccountCard key={acc.$id} account={acc} />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Connected Banks</CardTitle>
                        <CardDescription>No banks connected yet</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-muted-foreground">
                            Connect your first bank account to get started.
                          </div>
                          <Link href="/link-bank" className="inline-flex">
                            <Button className="gap-2">
                              <Building2 className="h-4 w-4" />
                              Connect bank
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
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
