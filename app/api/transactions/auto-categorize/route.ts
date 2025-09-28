export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { suggestCategory, findExistingCategory } from "@/lib/server/categorize";

export async function POST(request: Request) {
  try {
    const user: any = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 200;

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": process.env.APPWRITE_API_KEY as string };
    const databases = new Databases(client);

    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
    const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

    let offset = 0;
    let processed = 0;
    const pageSize = 100;
    while (processed < limit) {
      const page = await databases.listDocuments(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(pageSize),
        Query.offset(offset),
      ]);
      const docs = (page as any)?.documents || [];
      if (!docs.length) break;

      for (const d of docs) {
        if (processed >= limit) break;
        const needs = !d.category || d.category === '' || d.category === 'Uncategorized';
        const excluded = d.exclude === true;
        if (!needs || excluded) continue;
        const byDescription = await findExistingCategory(databases, DATABASE_ID, TRANSACTIONS_COLLECTION_ID, userId, d.description);
        const cat = byDescription || await suggestCategory(d.description, d.counterparty, d.amount, d.currency);
        await databases.updateDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, d.$id, { category: cat });
        processed += 1;
      }
      offset += docs.length;
      if (docs.length < pageSize) break;
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err: any) {
    console.error("Error triggering auto-categorization:", err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


