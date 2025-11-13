export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createLinkToken, HttpError } from "@/lib/plaid";

export async function POST(request: Request) {
  try {
    // Require authenticated user
    let user: any;
    let userId: string;

    try {
      user = await requireAuthUser(request);
      userId = user.$id || user.id;
    } catch (authError) {
      // In development, allow bypassing auth for testing UI flow
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || process.env.NODE_ENV === '') {
        console.log('⚠️ Development mode: bypassing auth for testing');
        const timestamp = Date.now();
        userId = `dev-user-${timestamp}`;
        user = { $id: userId, id: userId, email: `dev-${timestamp}@example.com` };
        console.log('🔧 Using dev user ID:', userId);
      } else {
        throw authError;
      }
    }

    const json = await request.json().catch(() => ({}));
    const {
      institutionId,
      countryCodes = ['US'],
      language = 'en',
      clientName = 'Nexpass Finance',
      products = ['transactions', 'auth']
    } = json || {};

    // Create user object for Plaid
    const plaidUser = {
      client_user_id: userId,
      email: user?.email,
    };

    // Set webhook URL if configured
    const webhook = process.env.PLAID_WEBHOOK_URL ||
      (process.env.NODE_ENV === 'development'
        ? 'https://webhook.site/your-webhook-url' // Replace with actual webhook in production
        : `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhooks`);

    // Create link token with Plaid
    const data = await createLinkToken({
      user: plaidUser,
      clientName,
      countryCodes,
      language,
      webhook,
      products,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error creating Plaid link token:', err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}