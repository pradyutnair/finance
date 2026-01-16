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
 * Detect recurring transactions.
 * A transaction is recurring if:
 * 1. It occurs more than once
 * 2. On the same day of each month
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

  // Group by counterparty and day of month
  const groups = new Map<string, Transaction[]>()

  for (const tx of filtered) {
    const date = new Date(tx.date || tx.bookingDate || "")
    const dayOfMonth = date.getDate()
    const counterparty = (tx.counterparty || tx.description || "Unknown").trim()

    // Create a key combining counterparty and day of month
    const key = `${counterparty}|${dayOfMonth}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(tx)
  }

  // Filter to only include groups with transactions from 2+ different months
  const recurring: RecurringTransaction[] = []

  for (const [key, txs] of groups.entries()) {
    // Count unique months (year-month) in this group
    const uniqueMonths = new Set(
      txs.map(tx => {
        const date = new Date(tx.date || tx.bookingDate || "")
        return `${date.getFullYear()}-${date.getMonth() + 1}`
      })
    )

    // Only include if transactions span 2+ different months
    if (uniqueMonths.size >= 2) {
      const counterparty = txs[0].counterparty || txs[0].description || "Unknown"
      const date = new Date(txs[0].date || txs[0].bookingDate || "")
      const dayOfMonth = date.getDate()
      const currency = txs[0].currency

      const totalAmount = txs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
      const avgAmount = totalAmount / txs.length

      const totalAbsAmount = txs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount) || 0), 0)
      const avgAbsAmount = totalAbsAmount / txs.length

      recurring.push({
        key,
        counterparty,
        category: txs[0].category || "Uncategorized",
        dayOfMonth,
        transactions: txs.sort((a, b) => {
          const dateA = new Date(a.date || a.bookingDate || "")
          const dateB = new Date(b.date || b.bookingDate || "")
          return dateB.getTime() - dateA.getTime() // Sort by date descending
        }),
        count: txs.length,
        avgAmount,
        avgAbsAmount,
        currency,
      })
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
