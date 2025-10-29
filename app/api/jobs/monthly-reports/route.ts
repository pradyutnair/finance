export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailScheduler } from "@/lib/scheduler";
import { emailService } from "@/lib/email-service";
import { insightsGenerator } from "@/lib/insights-generator";
import { EnhancedEmailTemplates } from "@/lib/email-templates";

/**
 * GET - Get monthly reports job status
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

    const jobStatus = emailScheduler.getJobStatus('monthly-reports');
    const jobHistory = emailScheduler.getJobHistory(10);

    return NextResponse.json({
      job: jobStatus,
      recentHistory: jobHistory.filter(h => h.jobId === 'monthly-reports'),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error getting monthly reports job status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to get job status" },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually trigger monthly reports job
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
    const { userId, testMode = false, month, year } = body;

    // If userId is provided, send monthly report to a specific user (for testing)
    if (userId && testMode) {
      // Verify the user making the request is authenticated
      const user = await requireAuthUser(request);

      // Generate monthly report for the specific user
      const report = await insightsGenerator.generateMonthlyReport(userId);
      if (!report) {
        return NextResponse.json(
          { error: "No monthly report data available for this user" },
          { status: 404 }
        );
      }

      // Override month/year if provided (for testing historical reports)
      if (month && year) {
        report.month = month;
        report.year = parseInt(year);
      }

      // Send the email
      const emailContent = EnhancedEmailTemplates.monthlyReport(report);
      const result = await emailService.sendEmailToUser({
        userId,
        content: emailContent,
        checkPreferences: true
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "Test monthly report sent successfully",
          messageId: result.messageId,
          report: {
            month: report.month,
            year: report.year,
            totalIncome: report.totalIncome,
            totalExpenses: report.totalExpenses,
            netSavings: report.netSavings,
            savingsRate: report.savingsRate,
            topCategoriesCount: report.topExpenseCategories.length,
            budgetPerformanceCount: report.budgetPerformance.length,
            insightsCount: report.insights.length
          }
        });
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
    }

    // Trigger the monthly reports job for all opted-in users
    const jobResult = await emailScheduler.triggerJob('monthly-reports');

    return NextResponse.json({
      success: jobResult.success,
      message: jobResult.success
        ? "Monthly reports job triggered successfully"
        : "Monthly reports job failed",
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
    console.error("Error triggering monthly reports job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger monthly reports job" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Enable/disable monthly reports job
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

    const success = emailScheduler.toggleJob('monthly-reports', enabled);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to update job status" },
        { status: 500 }
      );
    }

    const jobStatus = emailScheduler.getJobStatus('monthly-reports');

    return NextResponse.json({
      success: true,
      message: `Monthly reports job ${enabled ? 'enabled' : 'disabled'}`,
      job: jobStatus
    });
  } catch (error: any) {
    console.error("Error updating monthly reports job:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update job status" },
      { status: 500 }
    );
  }
}