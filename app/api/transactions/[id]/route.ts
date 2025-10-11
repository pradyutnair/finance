export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { Client, Databases, Query } from "appwrite"
import { invalidateUserCache } from "@/lib/server/cache-service"
import { getDb } from "@/lib/mongo/client"
import { encryptTransactionUpdateFields } from "@/lib/mongo/explicit-encryption"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(request)
    const userId = (user as any).$id || (user as any).id
    const { id } = await params
    const body = await request.json()

    // Only allow updating specific fields
    const updatePayload: Record<string, any> = {}
    if (typeof body.category === "string") updatePayload.category = body.category
    if (typeof body.exclude === "boolean") updatePayload.exclude = body.exclude
    if (typeof body.counterparty === "string") updatePayload.counterparty = body.counterparty
    if (body.counterparty === null || body.counterparty === undefined) {
      updatePayload.counterparty = body.counterparty
    }
    if (typeof body.description === "string") updatePayload.description = body.description
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 })
    }

    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb()
      const coll = db.collection('transactions_dev')
      
      // Explicitly encrypt sensitive fields in the update
      const encryptedUpdatePayload = await encryptTransactionUpdateFields(updatePayload)
      
      // Handle batch updates for similar transactions
      const similarTransactionIds = body.similarTransactionIds || []
      const allIds = [id, ...similarTransactionIds].filter(Boolean)
      
      // Update each transaction individually with encrypted fields
      let matchedCount = 0
      let modifiedCount = 0
      
      for (const txId of allIds) {
        // MongoDB uses string IDs (not ObjectId) for transactions
        // IDs are generated from transaction_id in the sync function
        const result = await coll.updateOne(
          { _id: txId, userId },
          { $set: encryptedUpdatePayload }
        )
        matchedCount += result.matchedCount
        modifiedCount += result.modifiedCount
      }

      if (matchedCount === 0) {
        return NextResponse.json({ ok: false, error: "Transaction not found" }, { status: 404 })
      }

      invalidateUserCache(userId, 'transactions')
      return NextResponse.json({ 
        ok: true, 
        updated: modifiedCount,
        totalMatched: matchedCount
      })
    }

    // Appwrite writes disabled - MongoDB is the primary backend
    return NextResponse.json({ 
      ok: false, 
      error: 'Appwrite writes are disabled. Set DATA_BACKEND=mongodb to update transactions.' 
    }, { status: 400 })
  } catch (err: any) {
    console.error("Error updating transaction:", err)
    const status = err?.status || 500
    const message = err?.message || "Internal Server Error"
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
