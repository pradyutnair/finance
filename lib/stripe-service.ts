import Stripe from 'stripe';

// Initialize Stripe with environment variables
function getStripeInstance(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
  });
}

export interface CheckoutSessionOptions {
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  userId?: string;
  metadata?: Record<string, string>;
}

export interface CustomerData {
  email: string;
  userId: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionData {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe checkout session for one-time payment or subscription
 */
export async function createCheckoutSession(options: CheckoutSessionOptions): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeInstance();

  try {
    const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription', // Using subscription mode for recurring payments
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      customer_email: options.customerEmail,
      metadata: {
        userId: options.userId || '',
        ...options.metadata,
      },
      allow_promotion_codes: true,
      billing_address_collection: {
        enabled: true,
      },
      custom_fields: [
        {
          key: 'userId',
          label: 'User ID',
          type: 'text',
          text: {
            type: 'text',
          },
        },
      ],
    };

    // Add existing customer if we have their Stripe customer ID
    if (options.customerEmail && options.userId) {
      const existingCustomers = await stripe.customers.list({
        email: options.customerEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        checkoutSessionParams.customer = existingCustomers.data[0].id;
      }
    }

    const session = await stripe.checkout.sessions.create(checkoutSessionParams);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create or retrieve a Stripe customer
 */
export async function createOrGetCustomer(data: CustomerData): Promise<Stripe.Customer> {
  const stripe = getStripeInstance();

  try {
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: data.email,
      limit: 1,
      metadata: {
        userId: data.userId,
      },
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: {
        userId: data.userId,
        ...data.metadata,
      },
    });

    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve a checkout session
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeInstance();

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'subscription'],
    });

    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    throw new Error(`Failed to retrieve session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a subscription for an existing customer
 */
export async function createSubscription(data: SubscriptionData): Promise<Stripe.Subscription> {
  const stripe = getStripeInstance();

  try {
    const subscription = await stripe.subscriptions.create({
      customer: data.customerId,
      items: [
        {
          price: data.priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
        collection_method: 'charge_automatically',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: data.metadata,
    });

    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
  const stripe = getStripeInstance();

  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId, {
      cancel_at_period_end: !immediately,
    });

    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get customer's active subscriptions
 */
export async function getCustomerSubscriptions(customerId: string): Promise<Stripe.ApiList<Stripe.Subscription>> {
  const stripe = getStripeInstance();

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });

    return subscriptions;
  } catch (error) {
    console.error('Error retrieving customer subscriptions:', error);
    throw new Error(`Failed to retrieve subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const stripe = getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
    return false;
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return true;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}