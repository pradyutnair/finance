export const runtime = "nodejs"
export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { requireAuthUser } from "@/lib/auth"
import { Client, Databases } from "appwrite"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser(request)
    const userId = (user as any).$id || (user as any).id
    const { id } = params
    const body = await request.json()

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string)

    const apiKey = process.env.APPWRITE_API_KEY as string | undefined
    if (apiKey) {
      ;(client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey }
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization")
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
      if (token) (client as any).headers = { ...(client as any).headers, "X-Appwrite-JWT": token }
    }

    const databases = new Databases(client)
    const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "68d42ac20031b27284c9") as string
    const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || "transactions_dev"

    // Only allow updating specific fields
    const updatePayload: Record<string, any> = {}
    if (typeof body.category === "string") updatePayload.category = body.category
    if (typeof body.exclude === "boolean") updatePayload.exclude = body.exclude
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid fields to update" }, { status: 400 })
    }

    // Ensure the doc belongs to the user by relying on Appwrite permissions or fetching first if needed
    const updated = await databases.updateDocument(
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      id,
      updatePayload
    )

    return NextResponse.json({ ok: true, transaction: updated })
  } catch (err: any) {
    console.error("Error updating transaction:", err)
    const status = err?.status || 500
    const message = err?.message || "Internal Server Error"
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}


