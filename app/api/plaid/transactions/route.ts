export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getTransactions, HttpError } from "@/lib/plaid";
import {
  queryPlaidTransactions,
  getPlaidTransactionAnalytics,
  syncPlaidAccountTransactions,
  deletePlaidTransactionsByAccount
} from "@/lib/plaid/plaid-mongo-ingestion";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    let user: any;
    let userId: string;

    try {
      user = await requireAuthUser(request);
      userId = user.$id || user.id;
    } catch (authError) {
      console.error('❌ Authentication failed:', authError);

      // In development, allow bypassing auth for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: bypassing auth for testing');
        userId = 'dev-user-123';
        user = { $id: userId, id: userId };
      } else {
        throw authError;
      }
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "transactions";
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
    const category = searchParams.get("category");
    const pending = searchParams.get("pending");
    const paymentChannel = searchParams.get("paymentChannel");
    const counterparty = searchParams.get("counterparty");
    const search = searchParams.get("search")?.trim();

    // Handle different request types
    if (type === "analytics") {
      // Return analytics data from transactions_plaid table
      const analytics = await getPlaidTransactionAnalytics(userId, {
        accountId: accountId || undefined,
        from: from || undefined,
        to: to || undefined,
      });

      return NextResponse.json({
        ok: true,
        analytics
      });

    } else {
      // Return transactions from transactions_plaid table
      const pendingFilter = pending !== null ? pending === "true" : undefined;

      const result = await queryPlaidTransactions(userId, {
        accountId: accountId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit,
        offset,
        category: category || undefined,
        pending: pendingFilter,
        paymentChannel: paymentChannel || undefined,
        counterparty: counterparty || undefined,
        search: search || undefined,
      });

      return NextResponse.json({
        ok: true,
        transactions: result.transactions,
        total: result.total,
        limit,
        offset
      });
    }

  } catch (err: any) {
    console.error('Error fetching Plaid transactions:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    // Require authenticated user
    let user: any;
    let userId: string;

    try {
      user = await requireAuthUser(request);
      userId = user.$id || user.id;
    } catch (authError) {
      console.error('❌ Authentication failed:', authError);

      // In development, allow bypassing auth for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: bypassing auth for testing');
        const timestamp = Date.now();
        userId = `dev-user-${timestamp}`;
        user = { $id: userId, id: userId };
        console.log('🔧 Using dev user ID:', userId);
      } else {
        throw authError;
      }
    }

    const json = await request.json().catch(() => ({}));
    const {
      action,
      accessToken,
      startDate,
      endDate,
      count = 100,
      offset = 0,
      accountId, // Optional: filter by specific account ID
    } = json || {};

    // Handle different actions
    if (action === "sync") {
      // Sync transactions to the transactions_plaid table
      if (!accessToken || !accountId) {
        throw new HttpError("accessToken and accountId are required for sync action", 400);
      }

      const syncResult = await syncPlaidAccountTransactions(
        userId,
        accessToken,
        accountId,
        startDate,
        endDate
      );

      return NextResponse.json({
        ok: true,
        syncResult
      });
    }

    if (action === "delete") {
      // Delete transactions from the transactions_plaid table
      if (!accountId) {
        throw new HttpError("accountId is required for delete action", 400);
      }

      const deletedCount = await deletePlaidTransactionsByAccount(userId, accountId);

      return NextResponse.json({
        ok: true,
        deletedCount
      });
    }

    // Legacy behavior - fetch transactions from Plaid API
    if (!accessToken) {
      throw new HttpError("'accessToken' is required", 400);
    }

    // Check cache first
    const globalAny = globalThis as any;
    globalAny.__acct_tx_cache = globalAny.__acct_tx_cache || new Map<string, { ts: number; payload: any }>();
    const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();
    const cacheKey = JSON.stringify({ accessToken: accessToken.slice(-20), startDate, endDate, count, offset, accountId });
    const cached = globalAny.__acct_tx_cache.get(cacheKey);

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      console.log('📋 Returning cached transactions data');
      return NextResponse.json(cached.payload);
    }

    // Get transactions from Plaid
    const data = await getTransactions(accessToken, {
      startDate,
      endDate,
      count,
      offset,
    });

    // Filter by account ID if provided
    let transactions = data.transactions || [];
    if (accountId) {
      transactions = transactions.filter((tx: any) => tx.account_id === accountId);
    }

    const payload = {
      transactions,
      total_transactions: data.total_transactions,
      item: data.item,
      accounts: data.accounts,
    };

    // Cache the result
    globalAny.__acct_tx_cache.set(cacheKey, { ts: now, payload });

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('Error fetching Plaid transactions:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}