export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { Client, Databases, Query } from "appwrite"
import { invalidateUserCache } from "@/lib/server/cache-service"
import { logger } from "@/lib/logger"
import { APPWRITE_CONFIG, COLLECTIONS } from "@/lib/config"
import { handleApiError } from "@/lib/api-error-handler"
import type { AuthUser, TransactionDocument } from "@/lib/types"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthUser(request)
    const userId = (user as AuthUser).$id || (user as AuthUser).id
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 })
    }
    
    const { id } = await params
    const body = await request.json() as { category?: string; exclude?: boolean }

    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId)

    const apiKey = APPWRITE_CONFIG.apiKey
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = { 
        ...(client as { headers: Record<string, string> }).headers, 
        "X-Appwrite-Key": apiKey 
      }
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization")
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
      if (token) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          "X-Appwrite-JWT": token 
        }
      }
    }

    const databases = new Databases(client)

    // Only allow updating specific fields
    const updatePayload: Partial<TransactionDocument> = {}
    if (typeof body.category === "string") updatePayload.category = body.category
    if (typeof body.exclude === "boolean") updatePayload.exclude = body.exclude
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 })
    }

    // Ensure the doc belongs to the user by relying on Appwrite permissions or fetching first if needed
    const updated = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      COLLECTIONS.transactions,
      id,
      updatePayload
    ) as unknown as TransactionDocument

    // When category is updated, also apply to similar transactions with same description or counterparty
    if (typeof updatePayload.category === "string") {
      const newCategory = updatePayload.category
      const description = updated.description
      const counterparty = updated.counterparty

      const updatedIds = new Set<string>([updated.$id])
      const pageLimit = 100

      async function updateByField(field: "description" | "counterparty", value: string) {
        if (!value || typeof value !== "string" || !userId) return
        let offset = 0
        while (true) {
          const filters = [
            Query.equal("userId", userId),
            Query.equal(field, value),
            Query.orderDesc("bookingDate"),
            Query.limit(pageLimit),
            Query.offset(offset),
          ]
          const page = await databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            COLLECTIONS.transactions,
            filters
          )
          const docs = (page.documents || []) as unknown as TransactionDocument[]
          if (!docs.length) break

          for (const doc of docs) {
            const docId = doc.$id
            if (updatedIds.has(docId)) continue
            updatedIds.add(docId)
            if (doc.category !== newCategory) {
              await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                COLLECTIONS.transactions,
                docId,
                { category: newCategory }
              )
            }
          }

          offset += docs.length
          if (docs.length < pageLimit) break
        }
      }

      if (typeof description === "string" && description.trim()) {
        await updateByField("description", description.trim())
      }
      if (typeof counterparty === "string" && counterparty.trim()) {
        await updateByField("counterparty", counterparty.trim())
      }
    }

    // Invalidate centralized cache for this user
    invalidateUserCache(userId, 'transactions')

    return NextResponse.json({ ok: true, transaction: updated })
  } catch (error: unknown) {
    return handleApiError(error, 500)
  }
}


