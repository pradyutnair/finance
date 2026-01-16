export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { getUserTransactionCache, filterTransactions, invalidateUserCache } from "@/lib/server/cache-service";
import { logger } from "@/lib/logger";
import { APPWRITE_CONFIG } from "@/lib/config";
import { handleApiError } from "@/lib/api-error-handler";
import type { AuthUser } from "@/lib/types";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request) as AuthUser;
    const userId = user.$id || user.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID not found" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
    const searchTerm = searchParams.get("search")?.trim() || null;
    const includeExcluded = searchParams.get("includeExcluded") === "true";
    const all = searchParams.get("all") === "true";

    // Create Appwrite client for cache service
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      (client as { headers: Record<string, string> }).headers = { 
        ...(client as { headers: Record<string, string> }).headers, 
        'X-Appwrite-Key': apiKey 
      };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) {
        (client as { headers: Record<string, string> }).headers = { 
          ...(client as { headers: Record<string, string> }).headers, 
          'X-Appwrite-JWT': token 
        };
      }
    }
    const databases = new Databases(client);

    // Get cached transactions (loads 365 days by default, all history if all=true)
    const allTransactions = await getUserTransactionCache(userId, databases, false, all);

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

  } catch (error: unknown) {
    return handleApiError(error, 500);
  }
}