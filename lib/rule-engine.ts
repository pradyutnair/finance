import type { TransactionRule, TransactionRuleCondition, TransactionRuleAction } from "@/lib/types/transaction-rules"

export interface Transaction {
  id: string
  counterparty?: string
  description?: string
  amount: number
  bookingDate: string
  category: string
  exclude?: boolean
}

export interface RuleMatch {
  rule: TransactionRule
  matched: boolean
  actions: TransactionRuleAction[]
}

/**
 * Check if a transaction matches a rule condition
 */
function matchesCondition(
  transaction: Transaction,
  condition: TransactionRuleCondition
): boolean {
  const fieldValue = getFieldValue(transaction, condition.field)
  const ruleValue = condition.value

  switch (condition.operator) {
    case "equals":
      return fieldValue === ruleValue
    case "notEquals":
      return fieldValue !== ruleValue
    case "contains":
      return typeof fieldValue === "string" &&
        (condition.caseSensitive
          ? fieldValue.includes(String(ruleValue))
          : fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase()))
    case "notContains":
      return typeof fieldValue === "string" &&
        (condition.caseSensitive
          ? !fieldValue.includes(String(ruleValue))
          : !fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase()))
    case "startsWith":
      return typeof fieldValue === "string" &&
        (condition.caseSensitive
          ? fieldValue.startsWith(String(ruleValue))
          : fieldValue.toLowerCase().startsWith(String(ruleValue).toLowerCase()))
    case "endsWith":
      return typeof fieldValue === "string" &&
        (condition.caseSensitive
          ? fieldValue.endsWith(String(ruleValue))
          : fieldValue.toLowerCase().endsWith(String(ruleValue).toLowerCase()))
    case "greaterThan":
      return Number(fieldValue) > Number(ruleValue)
    case "lessThan":
      return Number(fieldValue) < Number(ruleValue)
    case "greaterThanOrEqual":
      return Number(fieldValue) >= Number(ruleValue)
    case "lessThanOrEqual":
      return Number(fieldValue) <= Number(ruleValue)
    default:
      return false
  }
}

/**
 * Get the value of a field from a transaction
 */
function getFieldValue(transaction: Transaction, field: string): string | number {
  switch (field) {
    case "counterparty":
      return transaction.counterparty || ""
    case "description":
      return transaction.description || ""
    case "amount":
      return transaction.amount
    case "bookingDate":
      return transaction.bookingDate
    case "category":
      return transaction.category
    default:
      return ""
  }
}

/**
 * Check if a transaction matches a rule
 */
export function matchesRule(
  transaction: Transaction,
  rule: TransactionRule
): boolean {
  if (!rule.enabled || rule.conditions.length === 0) {
    return false
  }

  const conditionResults = rule.conditions.map(condition =>
    matchesCondition(transaction, condition)
  )

  // Combine condition results based on logic
  if (rule.conditionLogic === "OR") {
    return conditionResults.some(result => result)
  } else {
    // Default to AND
    return conditionResults.every(result => result)
  }
}

/**
 * Apply rule actions to a transaction
 */
export function applyRuleActions(
  transaction: Transaction,
  actions: TransactionRuleAction[]
): Partial<Transaction> {
  const updates: Partial<Transaction> = {}

  actions.forEach(action => {
    switch (action.type) {
      case "setCategory":
        updates.category = action.value as string
        break
      case "setExclude":
        updates.exclude = action.value as boolean
        break
      case "setDescription":
        updates.description = action.value as string
        break
      case "setCounterparty":
        updates.counterparty = action.value as string
        break
    }
  })

  return updates
}

/**
 * Find all rules that match a transaction
 */
export function findMatchingRules(
  transaction: Transaction,
  rules: TransactionRule[]
): TransactionRule[] {
  return rules.filter(rule => matchesRule(transaction, rule))
}

/**
 * Apply the highest priority matching rule to a transaction
 */
export function applyBestMatchingRule(
  transaction: Transaction,
  rules: TransactionRule[]
): {
  transaction: Transaction
  appliedRule?: TransactionRule
  updated: boolean
} {
  const matchingRules = findMatchingRules(transaction, rules)

  if (matchingRules.length === 0) {
    return { transaction, updated: false }
  }

  // Sort by priority (higher priority wins) and then by creation date (newer wins)
  const sortedRules = matchingRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const bestRule = sortedRules[0]
  const updates = applyRuleActions(transaction, bestRule.actions)

  return {
    transaction: { ...transaction, ...updates },
    appliedRule: bestRule,
    updated: true
  }
}

/**
 * Apply all matching rules to a transaction (for batch operations)
 */
export function applyAllMatchingRules(
  transaction: Transaction,
  rules: TransactionRule[]
): {
  transaction: Transaction
  appliedRules: TransactionRule[]
  updates: Partial<Transaction>
} {
  const matchingRules = findMatchingRules(transaction, rules)

  if (matchingRules.length === 0) {
    return { transaction, appliedRules: [], updates: {} }
  }

  // Sort by priority (higher priority wins) and then by creation date (newer wins)
  const sortedRules = matchingRules.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  let updates: Partial<Transaction> = {}

  // Apply rules in priority order - later rules can override earlier ones
  sortedRules.forEach(rule => {
    const ruleUpdates = applyRuleActions(transaction, rule.actions)
    updates = { ...updates, ...ruleUpdates }
  })

  return {
    transaction: { ...transaction, ...updates },
    appliedRules: sortedRules,
    updates
  }
}

/**
 * Apply rules to an array of transactions
 */
export function applyRulesToTransactions(
  transactions: Transaction[],
  rules: TransactionRule[],
  options?: {
    applyAll?: boolean // Apply all matching rules or just the best one
  }
): {
  transactions: Transaction[]
  ruleApplications: Array<{
    transactionId: string
    appliedRules: TransactionRule[]
    updated: boolean
  }>
  summary: {
    totalTransactions: number
    updatedTransactions: number
    totalRuleApplications: number
  }
} {
  const ruleApplications: Array<{
    transactionId: string
    appliedRules: TransactionRule[]
    updated: boolean
  }> = []

  const updatedTransactions = transactions.map(transaction => {
    if (options?.applyAll) {
      const result = applyAllMatchingRules(transaction, rules)
      if (result.updated) {
        ruleApplications.push({
          transactionId: transaction.id,
          appliedRules: result.appliedRules,
          updated: true
        })
      }
      return result.transaction
    } else {
      const result = applyBestMatchingRule(transaction, rules)
      if (result.updated) {
        ruleApplications.push({
          transactionId: transaction.id,
          appliedRules: result.appliedRule ? [result.appliedRule] : [],
          updated: true
        })
      }
      return result.transaction
    }
  })

  return {
    transactions: updatedTransactions,
    ruleApplications,
    summary: {
      totalTransactions: transactions.length,
      updatedTransactions: ruleApplications.length,
      totalRuleApplications: ruleApplications.reduce((sum, app) => sum + app.appliedRules.length, 0)
    }
  }
}

/**
 * Validate a rule's conditions and actions
 */
export function validateRule(rule: TransactionRule): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!rule.name?.trim()) {
    errors.push("Rule name is required")
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push("At least one condition is required")
  } else {
    rule.conditions.forEach((condition, index) => {
      if (!condition.field) {
        errors.push(`Condition ${index + 1}: Field is required`)
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`)
      }
      if (condition.value === undefined || condition.value === "") {
        errors.push(`Condition ${index + 1}: Value is required`)
      }
    })
  }

  if (!rule.actions || rule.actions.length === 0) {
    errors.push("At least one action is required")
  } else {
    rule.actions.forEach((action, index) => {
      if (!action.type) {
        errors.push(`Action ${index + 1}: Type is required`)
      }
      if (action.value === undefined || action.value === "") {
        errors.push(`Action ${index + 1}: Value is required`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors
  }
}