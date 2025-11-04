export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyWebhookSignature } from "@/lib/stripe-service";
import { updateUserSubscriptionStatus } from "@/lib/mongo/users-client";

// Assert environment variables
function assertStripeEnv(): void {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
  }
}

async function handleWebhookEvent(event: any): Promise<void> {
  const eventType = event.type;
  const data = event.data.object;

  console.log(`🔔 Processing Stripe webhook event: ${eventType}`);

  switch (eventType) {
    case 'checkout.session.completed': {
      const session = data;
      const userId = session.metadata?.userId;

      if (!userId) {
        console.error('❌ No userId in checkout session metadata');
        return;
      }

      console.log(`🎉 Processing completed checkout for user: ${userId}`);

      // For subscriptions, the subscription will be handled by the invoice events
      // For one-time payments, we could update status here
      if (session.mode === 'payment') {
        await updateUserSubscriptionStatus(userId, {
          isPremium: true,
          premiumActivatedAt: Date.now(),
        });
      }

      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = data;
      const subscription = invoice.subscription;

      if (subscription) {
        const userId = subscription.metadata?.userId || invoice.customer_metadata?.userId;

        if (!userId) {
          console.error('❌ No userId in invoice/subscription metadata');
          return;
        }

        console.log(`💳 Processing successful payment for user: ${userId}`);

        await updateUserSubscriptionStatus(userId, {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionCurrentPeriodEnd: subscription.current_period_end,
          isPremium: ['active', 'trialing'].includes(subscription.status),
          premiumActivatedAt: ['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
          premiumDeactivatedAt: !['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
        });
      }
      break;
    }

    case 'customer.subscription.created': {
      const subscription = data;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return;
      }

      console.log(`📋 Processing subscription creation for user: ${userId}`);

      await updateUserSubscriptionStatus(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: subscription.current_period_end,
        subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
        isPremium: ['active', 'trialing'].includes(subscription.status),
        premiumActivatedAt: ['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
        premiumDeactivatedAt: !['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = data;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.error('❌ No userId in subscription metadata');
        return;
      }

      console.log(`🔄 Processing subscription update for user: ${userId}`);

      await updateUserSubscriptionStatus(userId, {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionCurrentPeriodEnd: subscription.current_period_end,
        subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
        isPremium: ['active', 'trialing'].includes(subscription.status),
        premiumActivatedAt: ['active', 'trialing'].includes(subscription.status) && !subscription?.trial_end ? Date.now() : null,
        premiumDeactivatedAt: !['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = data;
      const userId = subscription.metadata?.userId;

      if (!userId) {
        console.error('❌ No userId in deleted subscription metadata');
        return;
      }

      console.log(`❌ Processing subscription deletion for user: ${userId}`);

      await updateUserSubscriptionStatus(userId, {
        stripeSubscriptionId: null,
        subscriptionStatus: 'cancelled',
        subscriptionCurrentPeriodEnd: null,
        subscriptionCancelAtPeriodEnd: false,
        isPremium: false,
        premiumDeactivatedAt: Date.now(),
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = data;
      const subscription = invoice.subscription;

      if (subscription) {
        const userId = subscription.metadata?.userId || invoice.customer_metadata?.userId;

        if (userId) {
          console.log(`💳 Processing failed payment for user: ${userId}`);

          // Update subscription status to past_due if applicable
          await updateUserSubscriptionStatus(userId, {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            isPremium: ['active', 'trialing'].includes(subscription.status),
            premiumDeactivatedAt: !['active', 'trialing'].includes(subscription.status) ? Date.now() : null,
          });
        }
      }
      break;
    }

    default:
      console.log(`ℹ️ Unhandled webhook event type: ${eventType}`);
  }
}

export async function POST(request: Request) {
  try {
    // Get headers
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('❌ Missing Stripe signature');
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Get raw body
    const body = await request.text();

    // Verify webhook signature
    assertStripeEnv();

    if (!verifyWebhookSignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse webhook event
    const event = JSON.parse(body);

    // Handle the webhook event
    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "webhook endpoint active",
    timestamp: new Date().toISOString(),
  });
}