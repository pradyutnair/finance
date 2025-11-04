import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { getUserSubscriptionDetails } from '@/lib/mongo/users-client';

export async function GET(request: Request) {
  try {
    // Get authenticated user
    const user = await requireAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = user;

    // Get user's subscription details from MongoDB
    const subscriptionDetails = await getUserSubscriptionDetails(userId);

    if (!subscriptionDetails) {
      return NextResponse.json({
        isPremium: false,
        subscriptionStatus: 'inactive',
        subscriptionCurrentPeriodEnd: null,
        stripeSubscriptionId: null,
        premiumActivatedAt: null,
        message: 'User not found'
      });
    }

    return NextResponse.json({
      isPremium: subscriptionDetails.isPremium,
      subscriptionStatus: subscriptionDetails.subscriptionStatus || 'inactive',
      subscriptionCurrentPeriodEnd: subscriptionDetails.subscriptionCurrentPeriodEnd || null,
      stripeSubscriptionId: subscriptionDetails.stripeSubscriptionId || null,
      premiumActivatedAt: subscriptionDetails.premiumActivatedAt || null,
      message: subscriptionDetails.isPremium ? 'User has premium access' : 'User does not have premium access'
    });

  } catch (error: any) {
    console.error('❌ Error fetching subscription status:', error);

    // Return appropriate error responses based on error type
    if (error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}