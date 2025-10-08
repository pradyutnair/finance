export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { suggestCategory, findExistingCategory, findExistingCategoryMongo } from "@/lib/server/categorize";
import { invalidateUserCache } from "@/lib/server/cache-service";
import { getDb } from "@/lib/mongo/client";

export async function POST(request: Request) {
  try {
    const user: any = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" ? body.limit : 200;

    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();
      const coll = db.collection('transactions_dev');
      
      const cursor = coll
        .find({ 
          userId,
          $and: [
            {
              $or: [
                { category: { $exists: false } },
                { category: '' },
                { category: 'Uncategorized' }
              ]
            },
            {
              $or: [
                { exclude: { $exists: false } },
                { exclude: false }
              ]
            }
          ]
        })
        .sort({ createdAt: -1 })
        .limit(limit);

      let processed = 0;
      for await (const d of cursor) {
        if (processed >= limit) break;
        console.log(`[auto-categorize] Categorizing tx ${d._id} desc='${d.description}' cp='${d.counterparty}'`);
        const byExisting = await findExistingCategoryMongo(db, 'transactions_dev', userId, d.description, d.counterparty);
        const cat = byExisting || await suggestCategory(d.description, d.counterparty, d.amount, d.currency);
        await coll.updateOne({ _id: d._id }, { $set: { category: cat } });
        console.log(`[auto-categorize] Updated tx ${d._id} => ${cat}`);
        processed++;
      }

      invalidateUserCache(userId, 'transactions');
      return NextResponse.json({ ok: true, processed });
    }

    // Appwrite writes disabled - MongoDB is the primary backend
    return NextResponse.json({ 
      ok: false, 
      error: 'Appwrite writes are disabled. Set DATA_BACKEND=mongodb to auto-categorize.' 
    }, { status: 400 })

    /* Legacy Appwrite code (disabled)
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, "X-Appwrite-JWT": token };
    }
    const databases = new Databases(client);

    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
    const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

    let offset = 0;
    let processed = 0;
    const pageSize = 100;
    while (processed < limit) {
      console.log(`[auto-categorize] Fetching page offset=${offset}, processed=${processed}/${limit}`)
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
        if (!needs || excluded) {
          console.log(`[auto-categorize] Skipping tx ${d.$id} needs=${needs} excluded=${excluded}`)
          continue;
        }
        console.log(`[auto-categorize] Categorizing tx ${d.$id} desc='${d.description}' cp='${d.counterparty}' amt=${d.amount} ${d.currency}`)
        const byExisting = await findExistingCategory(databases, DATABASE_ID, TRANSACTIONS_COLLECTION_ID, userId, d.description, d.counterparty);
        const cat = byExisting || await suggestCategory(d.description, d.counterparty, d.amount, d.currency);
        await databases.updateDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, d.$id, { category: cat });
        console.log(`[auto-categorize] Updated tx ${d.$id} => ${cat}`)
        processed += 1;
      }
      offset += docs.length;
      if (docs.length < pageSize) break;
    }

    // Invalidate centralized cache for this user
    invalidateUserCache(userId, 'transactions');

    return NextResponse.json({ ok: true, processed });
    */
  } catch (err: any) {
    console.error("Error triggering auto-categorization:", err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


