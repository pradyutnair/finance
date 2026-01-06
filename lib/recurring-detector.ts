import type { Transaction } from "@/lib/api"
import { logger } from "./logger"

export interface RecurringPattern {
  id: string
  description: string
  counterparty: string // Canonical payee name
  amount: number // Median amount
  amountStdDev?: number // Standard deviation of amounts
  amountMAD?: number // Median Absolute Deviation
  currency: string
  frequency: 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  intervalDays: number // Median interval in days
  confidence: number // 0-1
  coverage: number // observed / expected occurrences
  nextExpectedDate: string
  lastSeenDate: string
  transactionCount: number
  averageAmount: number
  occurrences: Array<{ id: string; date: string; amount: number }> // Transaction details
  category?: string
}

export interface RecurringDetectionOptions {
  minOccurrences?: number // Default 3
  confidenceThreshold?: number // Default 0.6
  minCoverage?: number // Default 0.6
  amountStabilityThreshold?: number // Default 0.05 (5%)
}

interface CadenceCandidate {
  frequency: RecurringPattern['frequency']
  expectedDays: number
  toleranceDays: number
  score: number
}

interface AmountCluster {
  median: number
  transactions: NormalizedTransaction[]
  mad: number
  stdDev: number
}

interface NormalizedTransaction extends Transaction {
  canonicalPayee: string
  normalizedPayee: string
  absAmount: number
  dateObj: Date
}

export class RecurringDetector {
  private options: Required<RecurringDetectionOptions>
  private canonicalPayeeMap: Map<string, string> = new Map()

  constructor(options: RecurringDetectionOptions = {}) {
    this.options = {
      minOccurrences: options.minOccurrences ?? 3,
      confidenceThreshold: options.confidenceThreshold ?? 0.6,
      minCoverage: options.minCoverage ?? 0.6,
      amountStabilityThreshold: options.amountStabilityThreshold ?? 0.05,
    }
  }

  /**
   * Detect recurring patterns from a list of transactions
   */
  detectRecurringPatterns(transactions: Transaction[]): RecurringPattern[] {
    if (transactions.length < this.options.minOccurrences) {
      return []
    }

    // 0) Preprocess: normalize and deduplicate
    const normalized = this.preprocessTransactions(transactions)
    
    // 1) Group by canonical payee
    const payeeGroups = this.groupByCanonicalPayee(normalized)
    
    // 2) For each payee group, cluster by amount and analyze cadence
    const patterns: RecurringPattern[] = []
    
    for (const [payee, txs] of payeeGroups.entries()) {
      if (txs.length < this.options.minOccurrences) continue
      
      // Amount clustering to separate multiple plans/tiers
      const amountClusters = this.clusterByAmount(txs)
      
      // Analyze each cluster for recurring patterns
      for (const cluster of amountClusters) {
        if (cluster.transactions.length < this.options.minOccurrences) continue
        
        const pattern = this.analyzeCadence(payee, cluster)
        if (pattern && pattern.confidence >= this.options.confidenceThreshold) {
          patterns.push(pattern)
        }
      }
    }
    
    // Sort by confidence descending
    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * 0) Preprocess transactions: parse, normalize, deduplicate
   */
  private preprocessTransactions(transactions: Transaction[]): NormalizedTransaction[] {
    const normalized: NormalizedTransaction[] = []
    const seenSameDay = new Map<string, NormalizedTransaction>()
    
    // CRITICAL: Only analyze expenses (negative amounts)
    const expenses = transactions.filter(tx => tx.amount < 0)
    logger.debug('Filtering for expenses', { expenseCount: expenses.length, totalCount: transactions.length })
    
    for (const tx of expenses) {
      const rawPayee = tx.counterparty || tx.description || 'UNKNOWN'
      const normalizedName = this.normalizePayeeName(rawPayee)
      const canonicalPayee = this.getCanonicalPayee(normalizedName, rawPayee)
      const absAmount = Math.abs(tx.amount)
      const dateObj = new Date(tx.date)
      
      const normalizedTx: NormalizedTransaction = {
        ...tx,
        canonicalPayee,
        normalizedPayee: normalizedName,
        absAmount,
        dateObj,
      }
      
      // Deduplicate same-day echoes (posted vs pending)
      const sameDayKey = `${canonicalPayee}:${tx.date}:${absAmount.toFixed(2)}`
      const existing = seenSameDay.get(sameDayKey)
      
      if (existing) {
        // Keep the one with higher confidence (prefer non-zero amounts, newer createdAt)
        if (absAmount > 0 && existing.absAmount === 0) {
          seenSameDay.set(sameDayKey, normalizedTx)
        }
        continue
      }
      
      seenSameDay.set(sameDayKey, normalizedTx)
      normalized.push(normalizedTx)
    }
    
    return normalized.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
  }

  /**
   * Normalize payee name: lowercase, remove punctuation, strip suffixes
   */
  private normalizePayeeName(raw: string): string {
    let normalized = raw.toLowerCase().trim()
    
    // Remove common payment processor prefixes
    normalized = normalized.replace(/^(sq\s*\*|paypal\s*\*|stripe\s*|apple\.com\/bill|google\s*\*|amzn\s+mktp|tst\s*\*|pos\s+)/i, '')
    
    // Remove punctuation except spaces
    normalized = normalized.replace(/[^\w\s]/g, ' ')
    
    // Remove legal suffixes and boilerplate
    const suffixes = ['ltd', 'llc', 'inc', 'bv', 'gmbh', 'sro', 'sa', 'spa', 'co', 'company', 'payments', 'payment', 'transfer', 'sepa', 'ach']
    for (const suffix of suffixes) {
      normalized = normalized.replace(new RegExp(`\\s+${suffix}\\s*$`, 'i'), '')
    }
    
    // Remove repeated spaces
    normalized = normalized.replace(/\s+/g, ' ').trim()
    
    // Remove store numbers, order IDs, etc
    normalized = normalized.replace(/\s*#?\d{3,}/g, '')
    
    return normalized
  }

  /**
   * Get or create canonical payee using fuzzy matching
   */
  private getCanonicalPayee(normalized: string, original: string): string {
    // Check if we already have a canonical mapping
    if (this.canonicalPayeeMap.has(normalized)) {
      return this.canonicalPayeeMap.get(normalized)!
    }
    
    // Try to find similar existing canonical payee
    for (const [existingNorm, canonical] of this.canonicalPayeeMap.entries()) {
      const similarity = this.computeSimilarity(normalized, existingNorm)
      if (similarity >= 0.9) {
        this.canonicalPayeeMap.set(normalized, canonical)
        return canonical
      }
    }
    
    // Create new canonical payee
    this.canonicalPayeeMap.set(normalized, original)
    return original
  }

  /**
   * Compute token-set similarity (Jaccard-like)
   */
  private computeSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.split(/\s+/))
    const tokens2 = new Set(str2.split(/\s+/))
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)))
    const union = new Set([...tokens1, ...tokens2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * 1) Group transactions by canonical payee
   */
  private groupByCanonicalPayee(transactions: NormalizedTransaction[]): Map<string, NormalizedTransaction[]> {
    const groups = new Map<string, NormalizedTransaction[]>()
    
    for (const tx of transactions) {
      if (!groups.has(tx.canonicalPayee)) {
        groups.set(tx.canonicalPayee, [])
      }
      groups.get(tx.canonicalPayee)!.push(tx)
    }
    
    return groups
  }

  /**
   * Cluster transactions by amount (1-D clustering with epsilon)
   */
  private clusterByAmount(transactions: NormalizedTransaction[]): AmountCluster[] {
    if (transactions.length === 0) return []
    
    // Sort by amount
    const sorted = [...transactions].sort((a, b) => a.absAmount - b.absAmount)
    
    const clusters: AmountCluster[] = []
    let currentCluster: NormalizedTransaction[] = [sorted[0]]
    
    for (let i = 1; i < sorted.length; i++) {
      const prevAmount = sorted[i - 1].absAmount
      const currAmount = sorted[i].absAmount
      
      // Epsilon: max(€1.00, 5% of amount)
      const epsilon = Math.max(1.0, 0.05 * prevAmount)
      
      if (Math.abs(currAmount - prevAmount) <= epsilon) {
        currentCluster.push(sorted[i])
      } else {
        // Finalize current cluster
        if (currentCluster.length >= 2) {
          clusters.push(this.createAmountCluster(currentCluster))
        }
        currentCluster = [sorted[i]]
      }
    }
    
    // Don't forget the last cluster
    if (currentCluster.length >= 2) {
      clusters.push(this.createAmountCluster(currentCluster))
    }
    
    // If no valid clusters, treat all as one cluster if enough transactions
    if (clusters.length === 0 && transactions.length >= this.options.minOccurrences) {
      clusters.push(this.createAmountCluster(transactions))
    }
    
    return clusters
  }

  /**
   * Create amount cluster with statistics
   * IMPORTANT: Re-sort by date before returning
   */
  private createAmountCluster(transactions: NormalizedTransaction[]): AmountCluster {
    const amounts = transactions.map(t => t.absAmount).sort((a, b) => a - b)
    const median = this.calculateMedian(amounts)
    const mad = this.calculateMAD(amounts, median)
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length
    const stdDev = Math.sqrt(variance)
    
    // CRITICAL FIX: Re-sort transactions by date (they were sorted by amount for clustering)
    const sortedByDate = [...transactions].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    
    return {
      median,
      transactions: sortedByDate,
      mad,
      stdDev,
    }
  }

  /**
   * 2) Analyze cadence for a payee+amount cluster
   */
  private analyzeCadence(payee: string, cluster: AmountCluster): RecurringPattern | null {
    const txs = cluster.transactions
    if (txs.length < 2) return null
    
    // Debug: Check if transactions are actually sorted by date
    logger.debug('Analyzing cadence - dates', { payee, dates: txs.slice(0, 5).map(t => t.date) })
    
    // Calculate intervals between consecutive transactions
    const intervals: number[] = []
    for (let i = 1; i < txs.length; i++) {
      const diffMs = txs[i].dateObj.getTime() - txs[i - 1].dateObj.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays > 0) {
        intervals.push(diffDays)
      }
    }
    
    logger.debug('Analyzing cadence - intervals', { payee, intervals: intervals.slice(0, 10), totalIntervals: intervals.length })
    
    if (intervals.length === 0) return null
    
    // Remove outliers (pro-rated first/last charges)
    const filteredIntervals = this.removeOutliers(intervals)
    if (filteredIntervals.length < Math.min(2, intervals.length)) {
      return null // Too many outliers
    }
    
    // Calculate interval statistics
    const medianInterval = this.calculateMedian(filteredIntervals)
    const madInterval = this.calculateMAD(filteredIntervals, medianInterval)
    const mean = filteredIntervals.reduce((s, v) => s + v, 0) / filteredIntervals.length
    const variance = filteredIntervals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / filteredIntervals.length
    const stdDev = Math.sqrt(variance)
    const cv = mean > 0 ? stdDev / mean : 0
    const iqr = this.calculateIQR(filteredIntervals)
    
    logger.debug('Analyzing cadence - statistics', { payee, medianInterval, cv: cv.toFixed(3), iqr })
    
    // Match cadence
    const cadenceMatch = this.matchCadence(medianInterval, iqr, cv, txs)
    logger.debug('Analyzing cadence - match result', { payee, cadenceMatch })
    
    if (!cadenceMatch) return null
    
    // Calculate coverage
    const firstDate = txs[0].dateObj
    const lastDate = txs[txs.length - 1].dateObj
    const spanDays = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
    const expected = Math.max(1, Math.ceil(spanDays / cadenceMatch.expectedDays))
    const coverage = Math.min(1.0, txs.length / expected)
    
    // Check amount stability
    const amountStable = this.isAmountStable(cluster)
    
    // Decision rules
    if (txs.length < this.options.minOccurrences) return null
    if (coverage < this.options.minCoverage) return null
    if (!amountStable && txs.length < 5) return null // Require more occurrences if amount varies
    
    // Calculate confidence
    const confidence = this.calculateConfidence(
      cadenceMatch.score,
      coverage,
      txs.length,
      amountStable ? 1 : 0.5
    )
    
    // Calculate next expected date
    const nextDate = this.calculateNextDate(
      txs[txs.length - 1].date,
      medianInterval,
      cadenceMatch.frequency,
      txs
    )
    
    return {
      id: `recurring_${txs[0].id}_${cadenceMatch.frequency}`,
      description: txs[0].description || payee,
      counterparty: payee,
      amount: cluster.median,
      amountStdDev: cluster.stdDev,
      amountMAD: cluster.mad,
      currency: txs[0].currency,
      frequency: cadenceMatch.frequency,
      intervalDays: medianInterval,
      confidence,
      coverage,
      nextExpectedDate: nextDate,
      lastSeenDate: txs[txs.length - 1].date,
      transactionCount: txs.length,
      averageAmount: txs.reduce((s, t) => s + t.absAmount, 0) / txs.length,
      occurrences: txs.map(t => ({
        id: t.id,
        date: t.date,
        amount: t.absAmount,
      })),
      category: txs[0].category,
    }
  }

  /**
   * Remove outliers using MAD method
   */
  private removeOutliers(intervals: number[]): number[] {
    if (intervals.length <= 2) return intervals
    
    const median = this.calculateMedian(intervals)
    const mad = this.calculateMAD(intervals, median)
    
    if (mad === 0) return intervals // All identical
    
    // Remove values more than 3 MAD away
    return intervals.filter(v => Math.abs(v - median) <= 3 * mad)
  }

  /**
   * Match intervals to a cadence
   */
  private matchCadence(
    medianInterval: number,
    iqr: number,
    cv: number,
    txs: NormalizedTransaction[]
  ): CadenceCandidate | null {
    const candidates: Array<{
      freq: RecurringPattern['frequency']
      days: number
      tolerance: number
    }> = [
      { freq: 'daily', days: 1, tolerance: 1 }, // Allow 0-2 days for daily
      { freq: 'weekly', days: 7, tolerance: 2 }, // 5-9 days
      { freq: 'bi_weekly', days: 14, tolerance: 3 }, // 11-17 days
      { freq: 'monthly', days: 30, tolerance: 4 }, // 26-34 days
      { freq: 'quarterly', days: 91, tolerance: 7 }, // 84-98 days
      { freq: 'yearly', days: 365, tolerance: 14 }, // 351-379 days
    ]
    
    let bestMatch: CadenceCandidate | null = null
    let bestScore = 0
    
    for (const candidate of candidates) {
      const diff = Math.abs(medianInterval - candidate.days)
      
      // Special handling for monthly: check day-of-month consistency
      if (candidate.freq === 'monthly') {
        const doms = txs.map(t => t.dateObj.getDate())
        const domMedian = this.calculateMedian(doms)
        const domMAD = this.calculateMAD(doms, domMedian)
        
        // If DOM is consistent and interval is 28-34 days, it's monthly
        if (domMAD <= 2 && medianInterval >= 27 && medianInterval <= 34) {
          const score = 1.0 - (diff / 10) // High score for monthly with consistent DOM
          if (score > bestScore) {
            bestScore = score
            bestMatch = {
              frequency: 'monthly',
              expectedDays: 30,
              toleranceDays: 4,
              score,
            }
          }
          continue
        }
      }
      
      // Regular matching
      if (diff <= candidate.tolerance) {
        const proximityScore = 1 - (diff / (candidate.tolerance + 1))
        const consistencyScore = Math.max(0, 1 - cv * 0.5)
        const score = proximityScore * 0.7 + consistencyScore * 0.3
        
        if (score > bestScore) {
          bestScore = score
          bestMatch = {
            frequency: candidate.freq,
            expectedDays: candidate.days,
            toleranceDays: candidate.tolerance,
            score,
          }
        }
      }
    }
    
    // If no match but intervals are consistent (cv <= 0.25), mark as custom
    if (!bestMatch && cv <= 0.25 && iqr <= 0.25 * medianInterval) {
      bestMatch = {
        frequency: 'custom',
        expectedDays: Math.round(medianInterval),
        toleranceDays: Math.round(medianInterval * 0.1),
        score: 0.6,
      }
    }
    
    return bestMatch
  }

  /**
   * Check if amounts are stable
   */
  private isAmountStable(cluster: AmountCluster): boolean {
    const relativeMad = cluster.median > 0 ? cluster.mad / cluster.median : 0
    return relativeMad <= this.options.amountStabilityThreshold || cluster.mad <= 3.0
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    cadenceScore: number,
    coverage: number,
    occurrences: number,
    amountStability: number
  ): number {
    const occurrenceScore = Math.min(1, (occurrences - 2) / 4)
    
    return (
      cadenceScore * 0.35 +
      coverage * 0.30 +
      occurrenceScore * 0.20 +
      amountStability * 0.15
    )
  }

  /**
   * Calculate next expected date
   */
  private calculateNextDate(
    lastDate: string,
    medianInterval: number,
    frequency: RecurringPattern['frequency'],
    txs: NormalizedTransaction[]
  ): string {
    const last = new Date(lastDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let next = new Date(last)
    
    // Calendar-based cadences
    if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
      // Get mode of day-of-month
      const doms = txs.map(t => t.dateObj.getDate())
      const domMedian = Math.round(this.calculateMedian(doms))
      
      if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1)
      } else if (frequency === 'quarterly') {
        next.setMonth(next.getMonth() + 3)
      } else {
        next.setFullYear(next.getFullYear() + 1)
      }
      
      // Set target day, clamping to month length
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      next.setDate(Math.min(domMedian, daysInMonth))
      
      // If still in past, advance one period
      while (next <= today) {
        if (frequency === 'monthly') {
          next.setMonth(next.getMonth() + 1)
        } else if (frequency === 'quarterly') {
          next.setMonth(next.getMonth() + 3)
        } else {
          next.setFullYear(next.getFullYear() + 1)
        }
        const daysInNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(domMedian, daysInNextMonth))
      }
    } else {
      // Interval-based cadences
      next.setDate(next.getDate() + Math.round(medianInterval))
      
      while (next <= today) {
        next.setDate(next.getDate() + Math.round(medianInterval))
      }
    }
    
    return next.toISOString().split('T')[0]
  }

  /**
   * Calculate median of array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  /**
   * Calculate Median Absolute Deviation
   */
  private calculateMAD(values: number[], median: number): number {
    if (values.length === 0) return 0
    const deviations = values.map(v => Math.abs(v - median))
    return this.calculateMedian(deviations)
  }

  /**
   * Calculate Interquartile Range
   */
  private calculateIQR(values: number[]): number {
    if (values.length < 2) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const q1Index = Math.floor(sorted.length * 0.25)
    const q3Index = Math.floor(sorted.length * 0.75)
    return sorted[q3Index] - sorted[q1Index]
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
