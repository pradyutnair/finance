export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createRequisition, HttpError } from "@/lib/gocardless";

export async function POST(request: Request) {
  try {
    // Authentication handled by frontend - only authenticated users can reach this
    const json = await request.json().catch(() => ({}));
    const { redirect, institutionId, reference, userLanguage, agreementId } = json || {};
    const data = await createRequisition({
      redirect,
      institutionId,
      reference,
      userLanguage,
      agreementId,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error creating requisition:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
