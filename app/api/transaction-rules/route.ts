import { NextRequest, NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongo/client"
import { ObjectId } from "mongodb"
import type { TransactionRule, TransactionRuleTestRequest, TransactionRuleTestResult, RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules"

// GET /api/transaction-rules - Fetch all transaction rules for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDb()
    const dbName = process.env.MONGODB_DB || 'finance_dev'
    const collectionName = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'

    const rules = await db.collection(collectionName)
      .find({ userId: user.$id })
      .sort({ priority: 1, createdAt: -1 })
      .toArray()

    // Convert MongoDB _id to id for frontend compatibility
    const rulesWithId = rules.map(rule => ({
      ...rule,
      id: rule._id.toString(),
    }))

    return NextResponse.json(rulesWithId)
  } catch (error) {
    console.error("Error fetching transaction rules:", error)
    return NextResponse.json(
      { error: "Failed to fetch transaction rules" },
      { status: 500 }
    )
  }
}

// POST /api/transaction-rules - Create a new transaction rule
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ruleData = await request.json()

    // Validate required fields
    if (!ruleData.name || !ruleData.conditions?.length || !ruleData.actions?.length) {
      return NextResponse.json(
        { error: "Name, conditions, and actions are required" },
        { status: 400 }
      )
    }

    const db = await getDb()
    const collectionName = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'

    const newRule: Omit<TransactionRule, "id"> = {
      userId: user.$id,
      name: ruleData.name,
      description: ruleData.description,
      enabled: ruleData.enabled ?? true,
      priority: ruleData.priority ?? 0,
      conditions: ruleData.conditions,
      conditionLogic: ruleData.conditionLogic || "AND",
      actions: ruleData.actions,
      matchCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await db.collection(collectionName).insertOne(newRule)

    const createdRule = {
      ...newRule,
      id: result.insertedId.toString(),
    }

    return NextResponse.json(createdRule, { status: 201 })
  } catch (error) {
    console.error("Error creating transaction rule:", error)
    return NextResponse.json(
      { error: "Failed to create transaction rule" },
      { status: 500 }
    )
  }
}