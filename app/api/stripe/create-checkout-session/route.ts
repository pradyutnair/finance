export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { createCheckoutSession, createOrGetCustomer } from "@/lib/stripe-service";
import { upsertUser } from "@/lib/mongo/users-client";

interface CheckoutRequest {
  successUrl: string;
  cancelUrl: string;
}

// Assert environment variables
function assertStripeEnv(): void {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) missing.push("NEXT_PUBLIC_STRIPE_PRICE_ID");
  if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");

  if (missing.length > 0) {
    throw new Error(`Missing Stripe environment variables: ${missing.join(", ")}`);
  }
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const user = await requireAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CheckoutRequest = await request.json();
    const { successUrl, cancelUrl } = body;

    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: "successUrl and cancelUrl are required" },
        { status: 400 }
      );
    }

    assertStripeEnv();

    const userId = (user as any).$id;
    const userEmail = (user as any).email;
    const userName = (user as any).name;

    // Check if user is already premium
    const { getUsersCollection } = await import("@/lib/mongo/users-client");
    const collection = await getUsersCollection();

    try {
      const existingUser = await collection.findOne({ userId });

      if (existingUser && existingUser.isPremium && existingUser.subscriptionStatus === 'active') {
        return NextResponse.json(
          { error: "User already has active premium subscription" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error checking user premium status:', error);
    }

    // Create or get Stripe customer
    const stripeCustomer = await createOrGetCustomer({
      email: userEmail,
      userId: userId,
      name: userName,
      metadata: {
        userId: userId,
        source: 'nexpass-checkout',
      },
    });

    // Create checkout session
    const checkoutSession = await createCheckoutSession({
      successUrl,
      cancelUrl,
      customerEmail: userEmail,
      userId: userId,
      metadata: {
        userId: userId,
        userEmail,
        userName: userName || '',
      },
    });

    // Update user record with Stripe customer ID
    await upsertUser({
      userId,
      email: userEmail,
      name: userName,
      stripeCustomerId: stripeCustomer.id,
    });

    console.log(`✅ Created checkout session for user ${userId}: ${checkoutSession.sessionId}`);

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.sessionId,
      url: checkoutSession.url,
    });

  } catch (error: any) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}