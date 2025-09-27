export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createRequisition, HttpError } from "@/lib/gocardless";
// No DB writes here; requisitions are persisted only after successful authorization in the callback

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
    const { redirect, institutionId, reference, userLanguage, agreementId } = json || {};
    
    // Ensure reference uses the same user ID format for consistent parsing
    const finalReference = reference || `user_${userId}_${Date.now()}`;
    console.log('🔗 Using reference:', finalReference);
    
    // Create requisition with GoCardless
    const data = await createRequisition({
      redirect,
      institutionId,
      reference: finalReference,
      userLanguage,
      agreementId,
    });

    // Do not persist requisition yet. Persist only after successful authorization in callback.

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
