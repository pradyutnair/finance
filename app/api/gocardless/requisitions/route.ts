export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createRequisition, createEndUserAgreement, getInstitution, HttpError } from "@/lib/gocardless";
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
    
    // Ensure an End User Agreement exists using the institution's max historical days
    let effectiveAgreementId: string | undefined = agreementId;
    if (!effectiveAgreementId) {
      if (!institutionId) throw new HttpError("'institutionId' is required", 400);
      const institution = await getInstitution(institutionId);
      // Prefer provider's transaction_total_days; fall back to other common keys if provided by API
      const ttlCandidates: any[] = [
        (institution as any)?.transaction_total_days,
        (institution as any)?.max_historical_days,
        (institution as any)?.max_history_days,
      ].filter((v) => v !== undefined && v !== null);
      const ttlParsed = ttlCandidates.map((v) => Number(v)).find((n) => Number.isFinite(n));
      const maxHistoricalDays = (ttlParsed as number | undefined) ?? 90;

      const accessValidCandidates: any[] = [
        (institution as any)?.max_access_valid_for_days,
        (institution as any)?.access_valid_for_days,
      ].filter((v) => v !== undefined && v !== null);
      const accessValidParsed = accessValidCandidates.map((v) => Number(v)).find((n) => Number.isFinite(n));
      const accessValidForDays = (accessValidParsed as number | undefined);

      const agreement = await createEndUserAgreement({
        institutionId,
        maxHistoricalDays,
        ...(typeof accessValidForDays === 'number' ? { accessValidForDays } : {}),
        accessScope: ["balances", "details", "transactions"],
      });
      effectiveAgreementId = agreement?.id as string | undefined;
      if (!effectiveAgreementId) {
        throw new HttpError('Failed to create end-user agreement (missing id)', 502);
      }
      console.log('📝 Created end-user agreement for requisition', { maxHistoricalDays, accessValidForDays, agreementId: effectiveAgreementId });
    }

    // Create requisition with GoCardless
    const data = await createRequisition({
      redirect,
      institutionId,
      reference: finalReference,
      userLanguage,
      agreementId: effectiveAgreementId,
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
