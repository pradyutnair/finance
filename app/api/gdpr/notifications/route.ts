import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { DATABASE_ID, PREFERENCES_BUDGETS_COLLECTION_ID, databases } from '@/lib/appwrite';

export async function GET(request: Request) {
  try {
    // Get current user
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    // Get user preferences from Appwrite
    const preferences = await databases.getDocument(
      DATABASE_ID,
      PREFERENCES_BUDGETS_COLLECTION_ID,
      userId
    );

    return NextResponse.json(preferences);
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);

    // If document doesn't exist, return default preferences
    if (error.code === 404) {
      return NextResponse.json({
        userId: 'current-user',
        emailNotifications: true,
        pushNotifications: false,
        marketingEmails: false,
        weeklyReports: false,
        monthlyReports: false,
        aiAnalysisConsent: false,
        aiInsightsConsent: false
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const body = await request.json();
    const { emailNotifications, pushNotifications, marketingEmails, weeklyReports, monthlyReports, aiAnalysisConsent, aiInsightsConsent } = body;


    console.log(" YO YO YOUser ID: ", userId);
    // Update or create preferences document
    const preferencesData = {
      userId: userId,
      emailNotifications: emailNotifications ?? true,
      pushNotifications: pushNotifications ?? false,
      marketingEmails: marketingEmails ?? false,
      weeklyReports: weeklyReports ?? false,
      monthlyReports: monthlyReports ?? false,
      aiInsightsConsent: aiInsightsConsent ?? false
    };

    try {
      // Try to update existing document
      await databases.updateDocument(
        DATABASE_ID,
        PREFERENCES_BUDGETS_COLLECTION_ID,
        userId,
        preferencesData
      );
    } catch (updateError: any) {
      if (updateError.code === 404) {
        // Create new document if it doesn't exist
        await databases.createDocument(
          DATABASE_ID,
          PREFERENCES_BUDGETS_COLLECTION_ID,
          userId,
          preferencesData
        );
      } else {
        throw updateError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
