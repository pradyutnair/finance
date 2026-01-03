"use client"

import { useMemo } from "react"
import { useDateRange } from "@/contexts/date-range-context"
import { useTransactions } from "@/lib/api"
import { detectRecurringTransactions } from "@/lib/recurring-detector"
import type { RecurringPattern } from "@/lib/recurring-detector"

export function useRecurringTransactionsWithDateRange() {
  const { dateRange } = useDateRange()

  // Fetch all transactions with all=true to get comprehensive data for pattern detection
  const {
    data: transactionsData,
    isLoading,
    error,
    refetch: refetchTransactions,
  } = useTransactions({
    all: true, // Get all transactions for pattern detection
    includeExcluded: false, // Don't analyze excluded transactions
    // Temporarily remove date range filtering to get all transactions
    // dateRange: dateRange ? {
    //   from: dateRange.from,
    //   to: dateRange.to,
    // } : undefined,
  })

  // Run recurring detection on the client side with decrypted transaction data
  const patterns = useMemo(() => {
    if (!transactionsData?.transactions) {
      return []
    }

    const transactions = transactionsData.transactions

    // Convert to format expected by detector - use exact counterparty to avoid duplicates
    const transactionData = transactions.map(tx => {
      const counterparty = tx.counterparty || tx.description || 'Unknown'
      return {
        id: tx.id,
        date: tx.bookingDate || tx.date || tx.valueDate || new Date().toISOString().split('T')[0],
        merchant: counterparty,
        counterparty: counterparty,
        description: tx.description,
        category: tx.category,
        amount: tx.amount, // Keep original sign - detector will filter for expenses (negative amounts)
        currency: tx.currency,
        accountId: tx.accountId,
      }
    })

    // Detect recurring patterns with production-ready parameters
    const detectedPatterns = detectRecurringTransactions(transactionData, {
      minOccurrences: 3, // Require at least 3 occurrences
      confidenceThreshold: 0.3, // More permissive confidence threshold
      minCoverage: 0.5, // 50% coverage required
      amountStabilityThreshold: 0.15, // 15% amount variation tolerance
    })

    return detectedPatterns
  }, [transactionsData?.transactions])

  return {
    patterns,
    total: patterns.length,
    isLoading,
    error,
    refetch: refetchTransactions,
    hasRecurringTransactions: patterns.length > 0,
    totalTransactions: transactionsData?.total || 0,
  }
}