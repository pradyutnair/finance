export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { suggestCategory, findExistingCategory } from "@/lib/server/categorize";
import { invalidateUserCache } from "@/lib/server/cache-service";
import { logger } from "@/lib/logger";
import { APPWRITE_CONFIG, COLLECTIONS } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import type { AuthUser, TransactionDocument } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = typeof body?.limit === "number" ? body.limit : 200;

    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = { 
        ...(client as { headers: Record<string, string> }).headers, 
        "X-Appwrite-Key": apiKey 
      };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          "X-Appwrite-JWT": token 
        };
      }
    }
    const databases = new Databases(client);

    let offset = 0;
    let processed = 0;
    const pageSize = 100;
    while (processed < limit) {
      logger.debug('Auto-categorize: Fetching page', { offset, processed, limit })
      const page = await databases.listDocuments(APPWRITE_CONFIG.databaseId, COLLECTIONS.transactions, [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(pageSize),
        Query.offset(offset),
      ]);
      const docs = (page.documents || []) as unknown as TransactionDocument[];
      if (!docs.length) break;

      for (const d of docs) {
        if (processed >= limit) break;
        const needs = !d.category || d.category === '' || d.category === 'Uncategorized';
        const excluded = d.exclude === true;
        if (!needs || excluded) {
          logger.debug('Auto-categorize: Skipping transaction', { transactionId: d.$id, needs, excluded })
          continue;
        }
        logger.debug('Auto-categorize: Categorizing transaction', { transactionId: d.$id, description: d.description, counterparty: d.counterparty, amount: d.amount, currency: d.currency })
        const byExisting = await findExistingCategory(databases, APPWRITE_CONFIG.databaseId, COLLECTIONS.transactions, userId, d.description, d.counterparty);
        const cat = byExisting || await suggestCategory(d.description, d.counterparty, d.amount, d.currency);
        await databases.updateDocument(APPWRITE_CONFIG.databaseId, COLLECTIONS.transactions, d.$id, { category: cat });
        logger.debug('Auto-categorize: Updated transaction', { transactionId: d.$id, category: cat })
        processed += 1;
      }
      offset += docs.length;
      if (docs.length < pageSize) break;
    }

    // Invalidate centralized cache for this user
    invalidateUserCache(userId, 'transactions');

    return NextResponse.json({ ok: true, processed });
  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}


