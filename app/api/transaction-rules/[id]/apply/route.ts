import { NextRequest, NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongo/client"
import { ObjectId } from "mongodb"
import type { RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules"

// POST /api/transaction-rules/[id]/apply - Apply a specific rule to transactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const options: RuleApplicationOptions = await request.json()

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 })
    }

    // Get the rule
    const db = await getDb()
    const rulesCollection = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'
    const transactionsCollection = process.env.MONGODB_TRANSACTIONS_COLLECTION || 'transactions_plaid'

    const rule = await db.collection(rulesCollection).findOne({
      _id: new ObjectId(id),
      userId: user.$id,
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (!rule.enabled) {
      return NextResponse.json({ error: "Rule is disabled" }, { status: 400 })
    }

    // Build MongoDB query from rule conditions
    const matchQuery: any = { userId: user.$id }

    // Apply rule conditions to MongoDB query
    const conditionQueries = rule.conditions.map(condition => {
      const fieldMap: Record<string, string> = {
        counterparty: "counterparty",
        description: "description",
        amount: "amount",
        bookingDate: "bookingDate",
        category: "category",
      }

      const mongoField = fieldMap[condition.field]
      if (!mongoField) return {}

      switch (condition.operator) {
        case "equals":
          return { [mongoField]: condition.value }
        case "notEquals":
          return { [mongoField]: { $ne: condition.value } }
        case "contains":
          return { [mongoField]: { $regex: condition.value, $options: condition.caseSensitive ? "" : "i" } }
        case "notContains":
          return { [mongoField]: { $not: { $regex: condition.value, $options: condition.caseSensitive ? "" : "i" } } }
        case "startsWith":
          return { [mongoField]: { $regex: `^${condition.value}`, $options: condition.caseSensitive ? "" : "i" } }
        case "endsWith":
          return { [mongoField]: { $regex: `${condition.value}$`, $options: condition.caseSensitive ? "" : "i" } }
        case "greaterThan":
          return { [mongoField]: { $gt: condition.value } }
        case "lessThan":
          return { [mongoField]: { $lt: condition.value } }
        case "greaterThanOrEqual":
          return { [mongoField]: { $gte: condition.value } }
        case "lessThanOrEqual":
          return { [mongoField]: { $lte: condition.value } }
        default:
          return {}
      }
    }).filter(query => Object.keys(query).length > 0)

    // Combine conditions based on logic
    if (conditionQueries.length > 0) {
      if (rule.conditionLogic === "OR") {
        matchQuery.$or = conditionQueries
      } else {
        // Default to AND
        conditionQueries.forEach(query => {
          Object.assign(matchQuery, query)
        })
      }
    }

    // Apply limit if specified
    const pipeline: any[] = [{ $match: matchQuery }]

    if (options.limit) {
      pipeline.push({ $limit: options.limit })
    }

    // Get matching transactions
    const matchingTransactions = await db.collection(transactionsCollection)
      .aggregate(pipeline)
      .toArray()

    if (options.dryRun) {
      return NextResponse.json({
        modifiedTransactions: matchingTransactions.map(tx => tx.transactionId),
        totalMatched: matchingTransactions.length,
        totalModified: 0,
      } as RuleApplicationResult)
    }

    // Prepare update operations based on rule actions
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

    // Update all matching transactions
    const updateResult = await db.collection(transactionsCollection).updateMany(
      {
        transactionId: { $in: matchingTransactions.map(tx => tx.transactionId) },
        userId: user.$id,
      },
      updateOperations
    )

    // Update rule statistics
    await db.collection(rulesCollection).updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { matchCount: updateResult.modifiedCount },
        $set: { lastMatched: new Date() }
      }
    )

    const result: RuleApplicationResult = {
      modifiedTransactions: matchingTransactions.slice(0, updateResult.modifiedCount).map(tx => tx.transactionId),
      totalMatched: matchingTransactions.length,
      totalModified: updateResult.modifiedCount,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error applying transaction rule:", error)
    return NextResponse.json(
      { error: "Failed to apply transaction rule" },
      { status: 500 }
    )
  }
}