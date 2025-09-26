"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTransactions } from "@/lib/api"
import { useDateRange } from "@/contexts/date-range-context"


function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'Food & Drink': '#f97316',
    'Transport': '#3b82f6',
    'Shopping': '#8b5cf6',
    'Bills': '#ef4444',
    'Entertainment': '#10b981',
    'Health': '#f59e0b',
    'Uncategorized': '#6b7280'
  }
  return colors[category] || '#6b7280'
}

export function RecentExpensesTable() {
  const { dateRange, formatDateForAPI } = useDateRange()
  
  const dateRangeForAPI = dateRange?.from && dateRange?.to ? {
    from: formatDateForAPI(dateRange.from),
    to: formatDateForAPI(dateRange.to)
  } : undefined

  const { data: transactionsData, isLoading, error } = useTransactions({ 
    limit: 10,
    dateRange: dateRangeForAPI
  })

  const recentExpenses = transactionsData?.transactions
    ?.filter((transaction: any) => parseFloat(String(transaction.amount)) < 0) // Only expenses
    ?.slice(0, 5) || [] // Limit to 5 most recent

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex ml-2 items-center justify-between p-3 border-b border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="w-2 h-2 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-16" />
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
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Failed to load recent expenses. Please try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (recentExpenses.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No expenses found for the selected period.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Expenses</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1">
          {recentExpenses.map((expense: any, index: number) => (
            <div 
              key={(expense as any).$id ?? expense.id ?? `${expense.accountId}-${(expense as any).transactionId ?? index}`}
              className={`flex ml-2 items-center justify-between p-3 hover:bg-muted/50 transition-colors ${
                index === recentExpenses.length - 1 ? '' : 'border-b border-border/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">
                    {expense.description || expense.counterparty || 'Unknown Transaction'}
                  </p>
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: getCategoryColor(expense.category || 'Uncategorized')
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(expense.bookingDate || expense.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-medium text-red-600 dark:text-red-400">
                  -{expense.currency} {Math.abs(parseFloat(String(expense.amount))).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
