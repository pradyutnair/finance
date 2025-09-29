export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getAccountTransactions, HttpError } from "@/lib/gocardless";

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    await requireAuthUser(request);
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom") || searchParams.get("date_from") || undefined;
    const dateTo = searchParams.get("dateTo") || searchParams.get("date_to") || undefined;

    const globalAny = globalThis as any;
    globalAny.__acct_tx_cache = globalAny.__acct_tx_cache || new Map<string, { ts: number; payload: any }>();
    const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();
    const cacheKey = JSON.stringify({ accountId, dateFrom, dateTo });
    const cached = globalAny.__acct_tx_cache.get(cacheKey);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

    const data = await getAccountTransactions(accountId, { dateFrom, dateTo });
    globalAny.__acct_tx_cache.set(cacheKey, { ts: now, payload: data });
    return NextResponse.json(data);
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
