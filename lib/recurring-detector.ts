import type { Transaction } from "@/lib/api"

export interface RecurringPattern {
  id: string
  description: string
  counterparty: string
  amount: number
  currency: string
  frequency: 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'yearly'
  confidence: number // 0-1
  nextExpectedDate: string
  lastSeenDate: string
  transactionCount: number
  averageAmount: number
  category?: string
}

export interface RecurringDetectionOptions {
  amountTolerance?: number // Default 0.1 (10%)
  dayTolerance?: number // Default 3 days
  minOccurrences?: number // Default 3
  confidenceThreshold?: number // Default 0.7
}

export class RecurringDetector {
  private options: Required<RecurringDetectionOptions>

  constructor(options: RecurringDetectionOptions = {}) {
    this.options = {
      amountTolerance: options.amountTolerance ?? 0.1,
      dayTolerance: options.dayTolerance ?? 3,
      minOccurrences: options.minOccurrences ?? 3,
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
    }
  }

  /**
   * Detect recurring patterns from a list of transactions
   */
  detectRecurringPatterns(transactions: Transaction[]): RecurringPattern[] {
    if (transactions.length < this.options.minOccurrences) {
      return []
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Simple grouping by exact counterparty name
    const groups = this.groupByCounterparty(sortedTransactions)

    // Create patterns from groups
    const patterns: RecurringPattern[] = []

    for (const [counterparty, group] of groups.entries()) {
      if (group.length >= this.options.minOccurrences) {
        const pattern = this.createSimplePattern(counterparty, group)
        if (pattern) {
          patterns.push(pattern)
        }
      }
    }

    // Filter by confidence threshold
    const filteredPatterns = patterns.filter(pattern =>
      pattern.confidence >= this.options.confidenceThreshold
    );

    return filteredPatterns
  }

  /**
   * Group transactions by exact counterparty name
   */
  private groupByCounterparty(transactions: Transaction[]): Map<string, Transaction[]> {
    const groups = new Map<string, Transaction[]>()

    for (const transaction of transactions) {
      const counterparty = (transaction.counterparty || transaction.description || 'Unknown').trim().toLowerCase()

      if (!groups.has(counterparty)) {
        groups.set(counterparty, [])
      }

      groups.get(counterparty)!.push(transaction)
    }

    return groups
  }

  /**
   * Create a simple recurring pattern from a group of transactions
   */
  private createSimplePattern(counterparty: string, group: Transaction[]): RecurringPattern | null {
    if (group.length < this.options.minOccurrences) return null

    const amounts = group.map(t => t.amount)
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length

    // Calculate amount consistency
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
    const stdDev = Math.sqrt(variance)
    const consistency = Math.max(0, 1 - (stdDev / avgAmount))

    // Base confidence on transaction count and amount consistency
    let confidence = 0.4
    confidence += Math.min(group.length * 0.05, 0.3)
    confidence += consistency * 0.3

    // Simple frequency detection based on amount
    const frequency = this.guessFrequencyFromAmount(avgAmount, counterparty)

    // Calculate next expected date
    const lastTransaction = group[group.length - 1]
    const nextDate = this.calculateNextDate(lastTransaction.date, frequency)

    return {
      id: `recurring_${group[0].id}_${frequency}`,
      description: group[0].description || counterparty,
      counterparty: counterparty,
      amount: avgAmount,
      currency: group[0].currency,
      frequency,
      confidence: Math.min(confidence, 1.0),
      nextExpectedDate: nextDate,
      lastSeenDate: lastTransaction.date,
      transactionCount: group.length,
      averageAmount: avgAmount,
      category: group[0].category,
    }
  }

  /**
   * Simple frequency detection based on amount and merchant type
   */
  private guessFrequencyFromAmount(amount: number, counterparty: string): RecurringPattern['frequency'] {
    const name = counterparty.toLowerCase()

    // Known monthly subscriptions
    if (name.includes('netflix') || name.includes('spotify') || name.includes('disney') ||
        name.includes('subscription') || name.includes('membership') || name.includes('gym')) {
      return 'monthly'
    }

    // Simple amount-based detection
    if (amount < 10) return 'weekly'
    if (amount < 100) return 'monthly'
    return 'monthly'
  }

  /**
   * Calculate next expected date
   */
  private calculateNextDate(lastDate: string, frequency: RecurringPattern['frequency']): string {
    const last = new Date(lastDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let next = new Date(last)

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1)
        while (next <= today) {
          next.setDate(next.getDate() + 1)
        }
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        while (next <= today) {
          next.setDate(next.getDate() + 7)
        }
        break
      case 'bi_weekly':
        next.setDate(next.getDate() + 14)
        while (next <= today) {
          next.setDate(next.getDate() + 14)
        }
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        while (next <= today) {
          next.setMonth(next.getMonth() + 1)
        }
        break
      case 'quarterly':
        next.setMonth(next.getMonth() + 3)
        while (next <= today) {
          next.setMonth(next.getMonth() + 3)
        }
        break
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1)
        while (next <= today) {
          next.setFullYear(next.getFullYear() + 1)
        }
        break
    }

    return next.toISOString().split('T')[0]
  }
}

/**
 * Convenience function to detect recurring patterns
 */
export function detectRecurringTransactions(
  transactions: Transaction[],
  options?: RecurringDetectionOptions
): RecurringPattern[] {
  const detector = new RecurringDetector(options)
  return detector.detectRecurringPatterns(transactions)
}