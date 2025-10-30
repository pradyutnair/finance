import { NextRequest, NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongo/client"
import { ObjectId } from "mongodb"
import type { RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules"

// POST /api/transaction-rules/apply-all - Apply all enabled rules to transactions
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const options: RuleApplicationOptions = await request.json()

    const db = await getDb()
    const rulesCollection = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'
    const transactionsCollection = process.env.MONGODB_TRANSACTIONS_COLLECTION || 'transactions_dev'

    // Get all enabled rules for the user, sorted by priority
    const rules = await db.collection(rulesCollection)
      .find({
        userId: user.$id,
        enabled: true
      })
      .sort({ priority: 1 })
      .toArray()

    if (rules.length === 0) {
      return NextResponse.json({
        modifiedTransactions: [],
        totalMatched: 0,
        totalModified: 0,
        errors: ["No enabled rules found"],
      } as RuleApplicationResult)
    }

    const modifiedTransactions: string[] = []
    const errors: string[] = []
    let totalModified = 0

    // Get all transactions for the user
    const transactionsQuery: any = { userId: user.$id }

    if (options.limit) {
      // If limit specified, we'll apply rules to the most recent transactions
      const transactions = await db.collection(transactionsCollection)
        .find(transactionsQuery)
        .sort({ bookingDate: -1 })
        .limit(options.limit)
        .toArray()

      // Apply each rule to each transaction
      for (const rule of rules) {
        try {
          const matchingTransactions = transactions.filter(tx =>
            transactionMatchesRule(tx, rule)
          )

          if (matchingTransactions.length > 0) {
            // Prepare update operations
            const updateOperations: any = { $set: {} }

            rule.actions.forEach(action => {
              switch (action.type) {
                case "setCategory":
                  updateOperations.$set.category = action.value
                  break
                case "setExclude":
                  updateOperations.$set.exclude = action.value
                  break
                case "setDescription":
                  updateOperations.$set.description = action.value
                  break
                case "setCounterparty":
                  updateOperations.$set.counterparty = action.value
                  break
              }
            })

            updateOperations.$set.updatedAt = new Date()

            const updateResult = await db.collection(transactionsCollection).updateMany(
              {
                _id: { $in: matchingTransactions.map(tx => tx._id) },
              },
              updateOperations
            )

            // Update rule statistics
            await db.collection(rulesCollection).updateOne(
              { _id: rule._id },
              {
                $inc: { matchCount: updateResult.modifiedCount },
                $set: { lastMatched: new Date() }
              }
            )

            totalModified += updateResult.modifiedCount
            modifiedTransactions.push(...matchingTransactions.map(tx => tx._id.toString()))
          }
        } catch (error) {
          console.error(`Error applying rule ${rule.name}:`, error)
          errors.push(`Failed to apply rule "${rule.name}"`)
        }
      }
    } else {
      // Apply rules to all transactions (more efficient batch approach)
      const allTransactions = await db.collection(transactionsCollection)
        .find(transactionsQuery)
        .toArray()

      for (const rule of rules) {
        try {
          const matchingTransactions = allTransactions.filter(tx =>
            transactionMatchesRule(tx, rule)
          )

          if (matchingTransactions.length > 0 && !options.dryRun) {
            // Prepare update operations
            const updateOperations: any = { $set: {} }

            rule.actions.forEach(action => {
              switch (action.type) {
                case "setCategory":
                  updateOperations.$set.category = action.value
                  break
                case "setExclude":
                  updateOperations.$set.exclude = action.value
                  break
                case "setDescription":
                  updateOperations.$set.description = action.value
                  break
                case "setCounterparty":
                  updateOperations.$set.counterparty = action.value
                  break
              }
            })

            updateOperations.$set.updatedAt = new Date()

            const updateResult = await db.collection(transactionsCollection).updateMany(
              {
                _id: { $in: matchingTransactions.map(tx => tx._id) },
              },
              updateOperations
            )

            // Update rule statistics
            await db.collection(rulesCollection).updateOne(
              { _id: rule._id },
              {
                $inc: { matchCount: updateResult.modifiedCount },
                $set: { lastMatched: new Date() }
              }
            )

            totalModified += updateResult.modifiedCount
            modifiedTransactions.push(...matchingTransactions.map(tx => tx._id.toString()))
          }
        } catch (error) {
          console.error(`Error applying rule ${rule.name}:`, error)
          errors.push(`Failed to apply rule "${rule.name}"`)
        }
      }
    }

    const result: RuleApplicationResult = {
      modifiedTransactions: [...new Set(modifiedTransactions)], // Remove duplicates
      totalMatched: modifiedTransactions.length,
      totalModified: options.dryRun ? 0 : totalModified,
      errors: errors.length > 0 ? errors : undefined,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error applying all transaction rules:", error)
    return NextResponse.json(
      { error: "Failed to apply transaction rules" },
      { status: 500 }
    )
  }
}

// Helper function to check if a transaction matches a rule
function transactionMatchesRule(transaction: any, rule: any): boolean {
  const conditionResults = rule.conditions.map((condition: any) => {
    const fieldValue = transaction[condition.field]
    const ruleValue = condition.value

    switch (condition.operator) {
      case "equals":
        return fieldValue === ruleValue
      case "notEquals":
        return fieldValue !== ruleValue
      case "contains":
        return typeof fieldValue === "string" &&
          fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase())
      case "notContains":
        return typeof fieldValue === "string" &&
          !fieldValue.toLowerCase().includes(String(ruleValue).toLowerCase())
      case "startsWith":
        return typeof fieldValue === "string" &&
          fieldValue.toLowerCase().startsWith(String(ruleValue).toLowerCase())
      case "endsWith":
        return typeof fieldValue === "string" &&
          fieldValue.toLowerCase().endsWith(String(ruleValue).toLowerCase())
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
  })

  // Combine condition results based on logic
  if (rule.conditionLogic === "OR") {
    return conditionResults.some((result: boolean) => result)
  } else {
    // Default to AND
    return conditionResults.every((result: boolean) => result)
  }
}