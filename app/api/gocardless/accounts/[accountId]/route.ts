export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getAccountDetails, getAccountBalances, HttpError } from "@/lib/gocardless";

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    await requireAuthUser(request);
    const { accountId } = await params;
    const globalAny = globalThis as any;
    globalAny.__acct_cache = globalAny.__acct_cache || new Map<string, { ts: number; payload: any }>();
    const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const cacheKey = accountId;
    const cached = globalAny.__acct_cache.get(cacheKey);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

    const [details, balances] = await Promise.all([
      getAccountDetails(accountId),
      getAccountBalances(accountId),
    ]);
    const payload = { details, balances };
    globalAny.__acct_cache.set(cacheKey, { ts: now, payload });
    return NextResponse.json(payload);
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
