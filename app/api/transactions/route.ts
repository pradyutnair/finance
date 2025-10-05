export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { getUserTransactionCache, filterTransactions, invalidateUserCache } from "@/lib/server/cache-service";
import { getDb } from "@/lib/mongo/client";

// NOTE: This route automatically supports encryption via the cache service.
// When ENCRYPTION_PROVIDER is set, getUserTransactionCache will:
// 1. Query transactions_public for queryable fields
// 2. Decrypt corresponding transactions_enc records
// 3. Merge and return decrypted data
// No changes needed here - encryption is transparent!

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request) as { $id?: string; id?: string };
    const userId = user.$id || user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
    const searchTerm = searchParams.get("search")?.trim() || null;
    const includeExcluded = searchParams.get("includeExcluded") === "true";

    // Create Appwrite client for cache service
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token };
    }
    const databases = new Databases(client);

    // Get cached transactions (loads 365 days on first call)
    const allTransactions = await getUserTransactionCache(userId!, databases);

    // Filter transactions based on request parameters
    const filtered = filterTransactions(allTransactions, {
      from,
      to,
      accountId,
      excludeExcluded: !includeExcluded,
      search: searchTerm
    });

    // Sort by booking date descending (should already be sorted from cache)
    filtered.sort((a, b) => {
      const dateA = a.bookingDate || a.valueDate || '';
      const dateB = b.bookingDate || b.valueDate || '';
      return dateB.localeCompare(dateA);
    });

    // Apply pagination
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      transactions: paged,
      total
    });

  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}