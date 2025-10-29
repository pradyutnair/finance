export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailScheduler } from "@/lib/scheduler";
import { emailService } from "@/lib/email-service";
import { insightsGenerator } from "@/lib/insights-generator";
import { EnhancedEmailTemplates } from "@/lib/email-templates";

/**
 * GET - Get weekly insights job status
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

    const jobStatus = emailScheduler.getJobStatus('weekly-insights');
    const jobHistory = emailScheduler.getJobHistory(10);

    return NextResponse.json({
      job: jobStatus,
      recentHistory: jobHistory.filter(h => h.jobId === 'weekly-insights'),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error getting weekly insights job status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get job status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually trigger weekly insights job
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
    const { userId, testMode = false } = body;

    // If userId is provided, send weekly insights to a specific user (for testing)
    if (userId && testMode) {
      // Verify the user making the request is authenticated
      const user = await requireAuthUser(request);

      // Generate weekly insights for the specific user
      const insights = await insightsGenerator.generateWeeklyInsights(userId);
      if (!insights) {
        return NextResponse.json(
          { error: "No weekly insights data available for this user" },
          { status: 404 }
        );
      }

      // Send the email
      const emailContent = EnhancedEmailTemplates.weeklyInsights(insights);
      const result = await emailService.sendEmailToUser({
        userId,
        content: emailContent,
        checkPreferences: true
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "Test weekly insights sent successfully",
          messageId: result.messageId,
          insights: {
            totalSpending: insights.totalSpending,
            spendingChange: insights.spendingChange,
            savingsRate: insights.savingsRate,
            topCategoriesCount: insights.topCategories.length,
            budgetAlertsCount: insights.budgetAlerts.length
          }
        });
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
    }

    // Trigger the weekly insights job for all opted-in users
    const jobResult = await emailScheduler.triggerJob('weekly-insights');

    return NextResponse.json({
      success: jobResult.success,
      message: jobResult.success
        ? "Weekly insights job triggered successfully"
        : "Weekly insights job failed",
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
  } catch (error: any) {
    console.error("Error triggering weekly insights job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger weekly insights job" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Enable/disable weekly insights job
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

    const success = emailScheduler.toggleJob('weekly-insights', enabled);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update job status" },
        { status: 500 }
      );
    }

    const jobStatus = emailScheduler.getJobStatus('weekly-insights');

    return NextResponse.json({
      success: true,
      message: `Weekly insights job ${enabled ? 'enabled' : 'disabled'}`,
      job: jobStatus
    });
  } catch (error: any) {
    console.error("Error updating weekly insights job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update job status" },
      { status: 500 }
    );
  }
}