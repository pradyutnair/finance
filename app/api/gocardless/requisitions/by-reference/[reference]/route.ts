export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listRequisitions, HttpError } from "@/lib/gocardless";

export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    console.log('🔍 Looking up requisition by reference:', reference);

    // List all requisitions and find the one with matching reference
    const requisitions = await listRequisitions();
    const matchingRequisition = requisitions.results?.find((req: any) => req.reference === reference);

    if (!matchingRequisition) {
      return NextResponse.json({ ok: false, error: "Requisition not found by reference" }, { status: 404 });
    }

    console.log('✅ Found requisition by reference:', matchingRequisition.id);
    
    return NextResponse.json({
      ok: true,
      requisitionId: matchingRequisition.id,
      requisition: matchingRequisition
    });

  } catch (err: any) {
    console.error("Error looking up requisition by reference:", err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
