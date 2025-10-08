export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { Client, Databases, Query } from "appwrite"
import { invalidateUserCache } from "@/lib/server/cache-service"
import { getDb } from "@/lib/mongo/client"
import { ObjectId } from "mongodb"

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthUser(request)
    const userId = (user as any).$id || (user as any).id
    const body = await request.json()
    
    const { transactionIds, updatePayload } = body
    
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ ok: false, error: "transactionIds must be a non-empty array" }, { status: 400 })
    }
    
    // Validate and update all transactions
    const db = await getDb()
    const coll = db.collection('transactions_dev')
    
    const result = await coll.updateMany(
      { _id: { $in: transactionIds.map(id => new ObjectId(id)) }, userId },
      { $set: updatePayload }
    )
    
    invalidateUserCache(userId, 'transactions')
    return NextResponse.json({ 
      ok: true, 
      updated: result.modifiedCount,
      totalMatched: result.matchedCount
    })
  } catch (err: any) {
    console.error("Error updating transaction:", err)
    const status = err?.status || 500
    const message = err?.message || "Internal Server Error"
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
