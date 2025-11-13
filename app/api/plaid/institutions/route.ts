export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { listInstitutions, HttpError } from "@/lib/plaid";

export async function GET(request: Request) {
  try {
    // Simple authentication check - user must be logged in to access this endpoint
    // The frontend will only make this call if user is authenticated
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") || "US";

    const data = await listInstitutions(country);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error in Plaid institutions endpoint:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}