export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getAccounts, getBalances, HttpError } from "@/lib/plaid";

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
    const { accessToken } = json || {};

    if (!accessToken) {
      throw new HttpError("'accessToken' is required", 400);
    }

    // Check cache first
    const globalAny = globalThis as any;
    globalAny.__acct_cache = globalAny.__acct_cache || new Map<string, { ts: number; payload: any }>();
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const cacheKey = `plaid_${accessToken.slice(-20)}`; // Use last 20 chars of access token as cache key
    const cached = globalAny.__acct_cache.get(cacheKey);

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      console.log('📋 Returning cached accounts data');
      return NextResponse.json(cached.payload);
    }

    // Get accounts and balances from Plaid
    const [accountsResponse, balancesResponse] = await Promise.all([
      getAccounts(accessToken),
      getBalances(accessToken),
    ]);

    // Combine accounts with their balances
    const accountsWithBalances = accountsResponse.accounts.map((account: any) => {
      const balance = balancesResponse.accounts.find((b: any) => b.account_id === account.account_id);
      return {
        ...account,
        balances: balance?.balances || account.balances,
      };
    });

    const payload = {
      accounts: accountsWithBalances,
      item: accountsResponse.item,
    };

    // Cache the result
    globalAny.__acct_cache.set(cacheKey, { ts: now, payload });

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('Error fetching Plaid accounts:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}