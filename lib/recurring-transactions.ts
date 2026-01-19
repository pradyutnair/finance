import type { Transaction } from "@/lib/api"

export interface RecurringTransaction {
  key: string
  counterparty: string
  category: string
  dayOfMonth: number
  transactions: Transaction[]
  count: number
  avgAmount: number
  avgAbsAmount: number
  currency: string
}

/**
 * Transfer-related keywords and categories to exclude
 */
const TRANSFER_KEYWORDS = [
  "transfer", "sepa", "ach", "wire", "bank transfer",
  "internal transfer", "account transfer"
]

const TRANSFER_CATEGORIES = [
  "Bank Transfer"
]

/**
 * Check if a transaction is a transfer
 */
function isTransfer(tx: Transaction): boolean {
  const categoryLower = tx.category?.toLowerCase() || ""
  const counterpartyLower = (tx.counterparty || tx.description || "").toLowerCase()

  // Check category
  if (TRANSFER_CATEGORIES.some(cat => categoryLower.includes(cat.toLowerCase()))) {
    return true
  }

  // Check keywords in counterparty/description
  if (TRANSFER_KEYWORDS.some(keyword => counterpartyLower.includes(keyword))) {
    return true
  }

  return false
}

/**
 * Get days in month for a given date
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Check if two days are within +/- 1 day of each other
 * Handles month boundaries (e.g., day 1 and last day of month are within 1 day)
 */
function areDaysWithinWindow(day1: number, daysInMonth1: number, day2: number, daysInMonth2: number): boolean {
  // Simple case: same day
  if (day1 === day2) return true

  // Check if day2 is within day1 +/- 1
  if (day2 === day1 - 1 || day2 === day1 + 1) return true

  // Handle month boundaries
  // Day 1 of a month is within 1 day of the last day of the previous month
  if (day1 === 1 && day2 === daysInMonth2) return true
  if (day2 === 1 && day1 === daysInMonth1) return true

  return false
}

/**
 * Detect recurring transactions.
 * A transaction is recurring if:
 * 1. It occurs more than once
 * 2. On the same day (+/- 1 day) of different months
 * 3. And the category is not "groceries"
 * 4. And it is not a transfer
 */
export function detectRecurringTransactions(
  transactions: Transaction[]
): RecurringTransaction[] {
  // Filter out groceries, transfers, marked as not recurring, and income (focus on subscriptions/expenses)
  const filtered = transactions.filter((tx) => {
    // Skip transactions marked as not recurring
    if (tx.isNotRecurring) {
      return false
    }

    const categoryLower = tx.category?.toLowerCase() || ""

    // Skip groceries
    if (categoryLower === "groceries") {
      return false
    }

    // Skip transfers
    if (isTransfer(tx)) {
      return false
    }

    // Skip income (positive amounts) - focus on subscriptions/expenses
    // But keep small positive amounts that could be refunds/credits
    return tx.amount <= 0 || Math.abs(tx.amount) < 5
  })

  // First, group by counterparty
  const byCounterparty = new Map<string, Transaction[]>()

  for (const tx of filtered) {
    const counterparty = (tx.counterparty || tx.description || "Unknown").trim()

    if (!byCounterparty.has(counterparty)) {
      byCounterparty.set(counterparty, [])
    }
    byCounterparty.get(counterparty)!.push(tx)
  }

  // For each counterparty, cluster transactions by day window (day +/- 1)
  const recurring: RecurringTransaction[] = []

  for (const [counterparty, txs] of byCounterparty.entries()) {
    // Sort transactions by date
    const sorted = [...txs].sort((a, b) => {
      const dateA = new Date(a.date || a.bookingDate || "")
      const dateB = new Date(b.date || b.bookingDate || "")
      return dateA.getTime() - dateB.getTime()
    })

    // Cluster transactions by day window
    const clusters: Transaction[][] = []

    for (const tx of sorted) {
      const txDate = new Date(tx.date || tx.bookingDate || "")
      const txDay = txDate.getDate()
      const txDaysInMonth = getDaysInMonth(txDate)

      // Try to add to existing cluster
      let added = false
      for (const cluster of clusters) {
        // Check if this transaction's day is within the cluster's day window
        const firstTxDate = new Date(cluster[0].date || cluster[0].bookingDate || "")
        const firstDay = firstTxDate.getDate()
        const firstDaysInMonth = getDaysInMonth(firstTxDate)

        if (areDaysWithinWindow(txDay, txDaysInMonth, firstDay, firstDaysInMonth)) {
          cluster.push(tx)
          added = true
          break
        }
      }

      // If not added to any cluster, create a new one
      if (!added) {
        clusters.push([tx])
      }
    }

    // Check each cluster for recurring pattern (2+ different months)
    for (const clusterTxs of clusters) {
      const uniqueMonths = new Set(
        clusterTxs.map(tx => {
          const date = new Date(tx.date || tx.bookingDate || "")
          return `${date.getFullYear()}-${date.getMonth() + 1}`
        })
      )

      if (uniqueMonths.size >= 2) {
        const currency = clusterTxs[0].currency

        const totalAmount = clusterTxs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
        const avgAmount = totalAmount / clusterTxs.length

        const totalAbsAmount = clusterTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)
        const avgAbsAmount = totalAbsAmount / clusterTxs.length

        // Use the first transaction's day as the canonical day
        const firstDate = new Date(clusterTxs[0].date || clusterTxs[0].bookingDate || "")
        const canonicalDay = firstDate.getDate()

        const key = `${counterparty}|${canonicalDay}`

        recurring.push({
          key,
          counterparty,
          category: clusterTxs[0].category || "Uncategorized",
          dayOfMonth: canonicalDay,
          transactions: clusterTxs.sort((a, b) => {
            const dateA = new Date(a.date || a.bookingDate || "")
            const dateB = new Date(b.date || b.bookingDate || "")
            return dateB.getTime() - dateA.getTime() // Sort by date descending
          }),
          count: clusterTxs.length,
          avgAmount,
          avgAbsAmount,
          currency,
        })
      }
    }
  }

  // Sort by count (descending) then by avgAbsAmount (descending)
  return recurring.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return b.avgAbsAmount - a.avgAbsAmount
  })
}
