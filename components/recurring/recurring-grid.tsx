"use client"

import { useState } from "react"
import { RefreshCw, Filter, SortAsc, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringCard } from "./recurring-card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { useCurrency } from "@/contexts/currency-context"
import type { RecurringPattern } from "@/lib/recurring-detector"

interface RecurringGridProps {
  patterns: RecurringPattern[]
  isLoading?: boolean
  onRefresh?: () => void
}

type SortOption = 'confidence' | 'nextDate' | 'amount' | 'frequency'
type FilterOption = 'all' | 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'yearly'

export function RecurringGrid({ patterns, isLoading = false, onRefresh }: RecurringGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('confidence')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const { formatAmount } = useCurrency()

  const frequencyOptions: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All frequencies' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi_weekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ]

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'confidence', label: 'Confidence' },
    { value: 'nextDate', label: 'Next expected' },
    { value: 'amount', label: 'Amount' },
    { value: 'frequency', label: 'Frequency' },
  ]

  // Filter patterns
  const filteredPatterns = patterns.filter(pattern => {
    if (filterBy === 'all') return true
    return pattern.frequency === filterBy
  })

  // Sort patterns
  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence
      case 'nextDate':
        return new Date(a.nextExpectedDate).getTime() - new Date(b.nextExpectedDate).getTime()
      case 'amount':
        return b.averageAmount - a.averageAmount
      case 'frequency':
        const frequencyOrder = { daily: 0, weekly: 1, bi_weekly: 2, monthly: 3, quarterly: 4, yearly: 5, custom: 6 }
        return frequencyOrder[a.frequency] - frequencyOrder[b.frequency]
      default:
        return 0
    }
  })

  // Calculate total recurring expenses (based on filtered patterns)
  const totalRecurringExpenses = filteredPatterns.reduce((sum, pattern) => {
    return sum + pattern.averageAmount
  }, 0)

  const getFrequencyStats = () => {
    const stats = patterns.reduce((acc, pattern) => {
      acc[pattern.frequency] = (acc[pattern.frequency] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(stats).map(([freq, count]) => ({
      frequency: freq as RecurringPattern['frequency'],
      count,
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Recurring Transactions</h2>
            <p className="text-muted-foreground">Detecting recurring patterns...</p>
          </div>
          <Button variant="outline" disabled>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No recurring transactions found</h3>
        <p className="text-muted-foreground max-w-md mb-4">
          We couldn&apos;t detect any recurring patterns in your transactions.
          Recurring transactions need at least 3 similar occurrences to be detected.
        </p>
        {onRefresh && (
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Recurring Transactions</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {getFrequencyStats().map(({ frequency, count }) => (
          <Badge key={frequency} variant="secondary" className="text-xs">
            {frequency}: {count}
          </Badge>
        ))}
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-4">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Total recurring expenses on the right */}
        <div className="text-sm font-medium">
          Total recurring expenses: {formatAmount(totalRecurringExpenses)}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedPatterns.length} of {patterns.length} patterns
      </div>

      {/* Grid */}
      {sortedPatterns.length === 0 ? (
        <EmptyState
          title="No patterns match your filters"
          description="Try adjusting your filters to see more results."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPatterns.map((pattern) => (
            <RecurringCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  )
}