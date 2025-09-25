export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getAccountDetails, getAccountBalances, HttpError } from "@/lib/gocardless";

export async function GET(request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    await requireAuthUser(request);
    const { accountId } = await params;
    const [details, balances] = await Promise.all([
      getAccountDetails(accountId),
      getAccountBalances(accountId),
    ]);
    return NextResponse.json({ details, balances });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
