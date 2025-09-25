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
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const data = await getAccountTransactions(accountId, { dateFrom, dateTo });
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
