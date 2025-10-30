import { NextRequest, NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { getDb } from "@/lib/mongo/client"
import { ObjectId } from "mongodb"
import type { TransactionRule, RuleApplicationOptions, RuleApplicationResult } from "@/lib/types/transaction-rules"

// PATCH /api/transaction-rules/[id] - Update a transaction rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const updates = await request.json()

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 })
    }

    // Check if rule exists and belongs to user
    const db = await getDb()
    const collectionName = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'

    const existingRule = await db.collection(collectionName).findOne({
      _id: new ObjectId(id),
      userId: user.$id,
    })

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Only update provided fields
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.conditions !== undefined) updateData.conditions = updates.conditions
    if (updates.conditionLogic !== undefined) updateData.conditionLogic = updates.conditionLogic
    if (updates.actions !== undefined) updateData.actions = updates.actions

    const result = await db.collection(collectionName).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    // Return updated rule
    const updatedRule = await db.collection(collectionName).findOne({
      _id: new ObjectId(id),
    })

    return NextResponse.json({
      ...updatedRule,
      id: updatedRule._id.toString(),
    })
  } catch (error) {
    console.error("Error updating transaction rule:", error)
    return NextResponse.json(
      { error: "Failed to update transaction rule" },
      { status: 500 }
    )
  }
}

// DELETE /api/transaction-rules/[id] - Delete a transaction rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 })
    }

    const db = await getDb()
    const collectionName = process.env.MONGODB_RULES_COLLECTION || 'transaction_rules_dev'

    // Check if rule exists and belongs to user
    const existingRule = await db.collection(collectionName).findOne({
      _id: new ObjectId(id),
      userId: user.$id,
    })

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const result = await db.collection(collectionName).deleteOne({
      _id: new ObjectId(id),
      userId: user.$id,
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting transaction rule:", error)
    return NextResponse.json(
      { error: "Failed to delete transaction rule" },
      { status: 500 }
    )
  }
}