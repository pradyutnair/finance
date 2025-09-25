export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createEndUserAgreement, HttpError } from "@/lib/gocardless";

export async function POST(request: Request) {
  try {
    await requireAuthUser(request);
    const json = await request.json().catch(() => ({}));
    const { institutionId, maxHistoricalDays, accessValidForDays, accessScope } = json || {};
    const data = await createEndUserAgreement({
      institutionId,
      maxHistoricalDays,
      accessValidForDays,
      accessScope,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
