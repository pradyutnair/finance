export interface TransactionRuleCondition {
  field: 'counterparty' | 'description' | 'amount' | 'bookingDate' | 'category'
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'notEquals' | 'notContains'
  value: string | number | Date
  caseSensitive?: boolean
}

export interface TransactionRuleAction {
  type: 'setCategory' | 'setExclude' | 'setDescription' | 'setCounterparty'
  value: string | boolean
}

export interface TransactionRule {
  id: string
  userId: string
  name: string
  description?: string
  enabled: boolean
  priority: number
  conditions: TransactionRuleCondition[]
  conditionLogic?: 'AND' | 'OR' // How to combine multiple conditions
  actions: TransactionRuleAction[]
  matchCount: number // Number of times this rule has been applied
  lastMatched?: Date
  createdAt: Date
  updatedAt: Date
}

export interface TransactionRuleTestRequest {
  rule: Omit<TransactionRule, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'matchCount' | 'lastMatched'>
  transactionIds?: string[] // If provided, test against specific transactions, otherwise test against all
}

export interface TransactionRuleTestResult {
  matchingTransactions: Array<{
    id: string
    counterparty: string
    description: string
    amount: number
    bookingDate: string
    category: string
  }>
  totalMatched: number
  sampleSize: number
}

export interface RuleApplicationOptions {
  applyToExisting?: boolean // Apply to all existing transactions
  dryRun?: boolean // Don't actually apply, just show what would happen
  limit?: number // Limit number of transactions to modify
}

export interface RuleApplicationResult {
  modifiedTransactions: string[]
  totalMatched: number
  totalModified: number
  errors?: string[]
}