"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTransactions } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"
import { TrendingDown, Receipt } from "lucide-react"
import { useCurrency } from "@/contexts/currency-context"
import { getCategoryColor } from "@/lib/categories"

// Currency symbol mapping
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'KRW': '₩',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'BRL': 'R$',
    'MXN': '$',
    'ZAR': 'R',
    'SGD': 'S$',
    'HKD': 'HK$',
    'NZD': 'NZ$'
  }
  return symbols[currency] || currency
}

// Colors now imported from shared categories schema

export function RecentExpensesTable() {
  const { dateRange, formatDateForAPI } = useDateRange()
  const { baseCurrency, convertAmount, getCurrencySymbol } = useCurrency()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { data: transactionsData, isLoading, error } = useTransactions({ 
    limit: 10,
    dateRange: dateRangeForAPI
  })

  const recentExpenses = transactionsData?.transactions
    //?.filter((transaction: any) => parseFloat(String(transaction.amount)) < 0)
    ?.slice(0, 6) || []

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Recent Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 pb-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !transactionsData) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Recent Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 px-4">
          <Receipt className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            Unable to load expenses
          </p>
          <p className="text-xs text-muted-foreground/70 text-center mt-1">
            Please try refreshing
          </p>
        </CardContent>
      </Card>
    )
  }

  if (recentExpenses.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Recent Expenses</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 px-4">
          <Receipt className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            No expenses yet
          </p>
          <p className="text-xs text-muted-foreground/70 text-center mt-1">
            Expenses will appear here once recorded
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-[380px] sm:h-[420px] md:h-[460px] lg:h-[520px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium">Recent Expenses</CardTitle>
        <TrendingDown className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 pb-4">
        {recentExpenses.map((tx: any, index: number) => {
            const amountOriginal = parseFloat(String(tx.amount)) || 0
            const amount = convertAmount(amountOriginal, tx.currency || "EUR", baseCurrency)
            const isIncome = amount > 0
            const colorClass = isIncome
              ? "text-gray-700 dark:text-gray-300 group-hover:text-green-700 dark:group-hover:text-green-700"
              : "text-gray-500 dark:text-gray-400 group-hover:text-destructive dark:group-hover:text-destructive"

            return (
              <div
                key={tx.$id ?? tx.id ?? `${tx.accountId}-${tx.transactionId ?? index}`}
                className="group flex items-center justify-between py-3 transition-all hover:px-2 rounded-md hover:bg-muted/40"
                style={{
                  animation: `fadeIn 0.3s ease-out ${index * 0.05}s backwards`,
                }}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div
                    className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ring-2 ring-background transition-transform group-hover:scale-125"
                    style={{
                      backgroundColor: getCategoryColor(tx.category || "Uncategorized"),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate text-foreground/90 group-hover:text-foreground transition-colors">
                      {tx.description || tx.counterparty || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {new Date(tx.bookingDate || tx.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year:
                          new Date(tx.bookingDate || tx.date).getFullYear() !==
                          new Date().getFullYear()
                            ? "numeric"
                            : undefined,
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <p className={`font-mono text-sm font-semibold ${colorClass}`}>
                    {isIncome ? "+" : "-"}
                    {getCurrencySymbol(baseCurrency)}
                    {Math.abs(amount).toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Card>
  )
}