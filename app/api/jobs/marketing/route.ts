export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailScheduler } from "@/lib/scheduler";
import { emailService } from "@/lib/email-service";
import { EnhancedEmailTemplates, MarketingEmailData } from "@/lib/email-templates";

/**
 * GET - Get marketing email job status
 */
export async function GET(request: Request) {
  try {
    // Verify API key for security (optional)
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.JOBS_API_KEY;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const jobStatus = emailScheduler.getJobStatus('marketing-emails');
    const jobHistory = emailScheduler.getJobHistory(10);

    return NextResponse.json({
      job: jobStatus,
      recentHistory: jobHistory.filter(h => h.jobId === 'marketing-emails'),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error getting marketing email job status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get job status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Send marketing emails or trigger marketing job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key for security
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.JOBS_API_KEY;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      userId,
      testMode = false,
      campaignType,
      customCampaign,
      triggerJob = false
    } = body;

    // If triggerJob is true, run the scheduled marketing job
    if (triggerJob) {
      const jobResult = await emailScheduler.triggerJob('marketing-emails');

      return NextResponse.json({
        success: jobResult.success,
        message: jobResult.success
          ? "Marketing emails job triggered successfully"
          : "Marketing emails job failed",
        jobResult: {
          jobId: jobResult.jobId,
          success: jobResult.success,
          startTime: jobResult.startTime,
          endTime: jobResult.endTime,
          duration: jobResult.endTime.getTime() - jobResult.startTime.getTime(),
          error: jobResult.error,
          recipientsProcessed: jobResult.recipientsProcessed,
          recipientsSuccessful: jobResult.recipientsSuccessful,
          recipientsFailed: jobResult.recipientsFailed
        }
      });
    }

    // If userId is provided, send marketing email to a specific user (for testing)
    if (userId && testMode) {
      // Verify the user making the request is authenticated
      const user = await requireAuthUser(request);

      let marketingData: MarketingEmailData;

      if (customCampaign) {
        // Use custom campaign data
        marketingData = customCampaign;
      } else if (campaignType) {
        // Use predefined campaign type
        marketingData = getMarketingCampaignData(campaignType);
      } else {
        // Default financial tip campaign
        marketingData = getMarketingCampaignData('financial_tip');
      }

      // Send the marketing email
      let emailContent;
      if (marketingData.campaignType === 'feature_announcement') {
        emailContent = EnhancedEmailTemplates.marketing.featureAnnouncement(marketingData);
      } else {
        emailContent = EnhancedEmailTemplates.marketing.financialTip(marketingData);
      }

      const result = await emailService.sendEmailToUser({
        userId,
        content: emailContent,
        checkPreferences: true
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "Test marketing email sent successfully",
          messageId: result.messageId,
          campaign: {
            type: marketingData.campaignType,
            subject: marketingData.subject,
            headline: marketingData.content.headline
          }
        });
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Either userId with testMode=true or triggerJob=true is required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error sending marketing emails:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send marketing emails" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Enable/disable marketing email job
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify API key for security
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.JOBS_API_KEY;

    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: "enabled field must be a boolean" },
        { status: 400 }
      );
    }

    const success = emailScheduler.toggleJob('marketing-emails', enabled);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update job status" },
        { status: 500 }
      );
    }

    const jobStatus = emailScheduler.getJobStatus('marketing-emails');

    return NextResponse.json({
      success: true,
      message: `Marketing emails job ${enabled ? 'enabled' : 'disabled'}`,
      job: jobStatus
    });
  } catch (error: any) {
    console.error("Error updating marketing emails job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update job status" },
      { status: 500 }
    );
  }
}

/**
 * Get predefined marketing campaign data
 */
function getMarketingCampaignData(type: string): MarketingEmailData {
  const campaigns = {
    financial_tip: {
      campaignType: 'financial_tip' as const,
      subject: '💡 Weekly Financial Tip: Smart Saving Strategies',
      content: {
        headline: 'Boost Your Savings with These Simple Tips',
        mainMessage: 'Small changes in your daily habits can lead to significant savings over time. Here are some proven strategies to help you save more without sacrificing your lifestyle.',
        features: [
          'Automate your savings - set up automatic transfers to savings right after payday',
          'Use the 24-hour rule for non-essential purchases over $50',
          'Review subscriptions monthly and cancel what you don\'t use',
          'Pack lunch 3-4 days a week instead of eating out',
          'Use cashback apps and credit card rewards for purchases you\'d make anyway'
        ],
        ctaText: 'Read More Financial Tips',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    },

    feature_announcement: {
      campaignType: 'feature_announcement' as const,
      subject: '🎉 New Feature: Enhanced Analytics Dashboard',
      content: {
        headline: 'Track Your Finances Like Never Before',
        mainMessage: 'We\'ve just launched powerful new analytics features to help you better understand your spending patterns and make smarter financial decisions.',
        features: [
          'Interactive spending charts with category breakdowns',
          'Budget progress tracking with visual indicators',
          'Trend analysis to see how your habits change over time',
          'Personalized insights based on your spending patterns',
          'Export functionality for financial reports'
        ],
        ctaText: 'Explore New Features',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    },

    onboarding: {
      campaignType: 'onboarding' as const,
      subject: '👋 Welcome to Nexpass! Get Started in 3 Easy Steps',
      content: {
        headline: 'Your Financial Journey Starts Here',
        mainMessage: 'Ready to take control of your finances? Here\'s how to get the most out of Nexpass from day one.',
        features: [
          'Connect your bank accounts to automatically track transactions',
          'Set up budgets for your main spending categories',
          'Explore your spending insights and patterns',
          'Set financial goals and track your progress',
          'Enable weekly and monthly reports for regular updates'
        ],
        ctaText: 'Complete Your Profile',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    },

    re_engagement: {
      campaignType: 're_engagement' as const,
      subject: '👀 We Miss You! Here\'s What You\'ve Been Missing',
      content: {
        headline: 'Your Financial Insights Are Waiting',
        mainMessage: 'It\'s been a while since you last checked in. Your financial data has been working hard in the background, and we\'ve got some insights to share.',
        features: [
          'See your spending trends for the past month',
          'Check how you\'re tracking against your budgets',
          'Discover new ways to save with our updated analytics',
          'Get personalized tips based on your spending patterns',
          'Set up automated reports to stay on track'
        ],
        ctaText: 'Check Your Dashboard',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    }
  };

  return campaigns[type as keyof typeof campaigns] || campaigns.financial_tip;
}