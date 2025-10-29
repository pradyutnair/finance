export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailService } from "@/lib/email-service";
import { insightsGenerator } from "@/lib/insights-generator";
import { EnhancedEmailTemplates } from "@/lib/email-templates";
import { emailScheduler } from "@/lib/scheduler";

/**
 * POST - Run comprehensive email automation tests
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const body = await request.json();
    const { testType = 'comprehensive' } = body;

    const testResults = {
      timestamp: new Date().toISOString(),
      userId,
      testType,
      results: [] as Array<{
        testName: string;
        success: boolean;
        duration: number;
        error?: string;
        details?: any;
      }>,
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0
      }
    };

    const startTime = Date.now();

    // Test 1: Basic Email Service Connection
    await runTest(testResults, 'Email Service Connection', async () => {
      const userData = await emailService.getUserData(userId);
      if (!userData) {
        throw new Error('Could not fetch user data');
      }
      return {
        email: userData.email,
        hasName: !!userData.name,
        hasPreferences: !!userData.preferences
      };
    });

    // Test 2: Preference Checking
    await runTest(testResults, 'User Preference Checking', async () => {
      const weeklyPrefs = await emailService.canSendWeeklyReport(userId);
      const monthlyPrefs = await emailService.canSendMonthlyReport(userId);
      const marketingPrefs = await emailService.canSendMarketingEmail(userId);

      return {
        weeklyReports: weeklyPrefs,
        monthlyReports: monthlyPrefs,
        marketingEmails: marketingPrefs
      };
    });

    // Test 3: Insights Generation
    await runTest(testResults, 'Weekly Insights Generation', async () => {
      const weeklyInsights = await insightsGenerator.generateWeeklyInsights(userId, user.name);

      if (!weeklyInsights) {
        return { message: 'No weekly data available (expected for new users)' };
      }

      return {
        hasSpendingData: weeklyInsights.totalSpending > 0,
        hasTopCategories: weeklyInsights.topCategories.length > 0,
        hasWeeklyTip: !!weeklyInsights.weeklyTip,
        periodRange: `${weeklyInsights.periodStart} - ${weeklyInsights.periodEnd}`
      };
    });

    // Test 4: Monthly Report Generation
    await runTest(testResults, 'Monthly Report Generation', async () => {
      const monthlyReport = await insightsGenerator.generateMonthlyReport(userId, user.name);

      if (!monthlyReport) {
        return { message: 'No monthly data available (expected for new users)' };
      }

      return {
        month: monthlyReport.month,
        year: monthlyReport.year,
        hasIncomeData: monthlyReport.totalIncome > 0,
        hasExpenseData: monthlyReport.totalExpenses > 0,
        hasInsights: monthlyReport.insights.length > 0
      };
    });

    // Test 5: Email Template Rendering
    await runTest(testResults, 'Email Template Rendering', async () => {
      // Test weekly template
      const mockWeeklyData = {
        userName: user.name || 'Test User',
        totalSpending: 1500.50,
        spendingChange: -12.5,
        topCategories: [
          { name: 'Groceries', amount: 450.25, percentage: 30 },
          { name: 'Transport', amount: 300.15, percentage: 20 }
        ],
        budgetAlerts: [],
        savingsRate: 15.2,
        weeklyTip: 'Test tip for better financial health.',
        periodStart: 'Jan 01',
        periodEnd: 'Jan 07, 2024'
      };

      const weeklyEmail = EnhancedEmailTemplates.weeklyInsights(mockWeeklyData);

      // Test monthly template
      const mockMonthlyData = {
        userName: user.name || 'Test User',
        month: 'January',
        year: 2024,
        totalIncome: 5000.00,
        totalExpenses: 3200.75,
        netSavings: 1799.25,
        savingsRate: 36.0,
        topExpenseCategories: [
          { name: 'Rent/Mortgage', amount: 1200.00, percentage: 37.5 }
        ],
        budgetPerformance: [],
        insights: ['Test insight for financial improvement.'],
        monthlyTip: 'Test monthly financial advice.'
      };

      const monthlyEmail = EnhancedEmailTemplates.monthlyReport(mockMonthlyData);

      return {
        weeklyTemplate: {
          hasSubject: !!weeklyEmail.subject,
          hasHtml: !!weeklyEmail.html,
          hasText: !!weeklyEmail.text,
          htmlLength: weeklyEmail.html?.length || 0
        },
        monthlyTemplate: {
          hasSubject: !!monthlyEmail.subject,
          hasHtml: !!monthlyEmail.html,
          hasText: !!monthlyEmail.text,
          htmlLength: monthlyEmail.html?.length || 0
        }
      };
    });

    // Test 6: Test Email Sending (if user has opted in)
    await runTest(testResults, 'Test Email Sending', async () => {
      const canSendWeekly = await emailService.canSendWeeklyReport(userId);

      if (!canSendWeekly) {
        return {
          message: 'User has not opted in for weekly emails - test email skipped',
          optedIn: false
        };
      }

      // Generate real insights if possible, otherwise use mock data
      const insights = await insightsGenerator.generateWeeklyInsights(userId, user.name);

      const emailContent = insights
        ? EnhancedEmailTemplates.weeklyInsights(insights)
        : EnhancedEmailTemplates.weeklyInsights({
            userName: user.name || 'Test User',
            totalSpending: 100,
            spendingChange: 0,
            topCategories: [],
            budgetAlerts: [],
            savingsRate: 10,
            weeklyTip: 'This is a test weekly insight email.',
            periodStart: 'Test Start',
            periodEnd: 'Test End'
          });

      const result = await emailService.sendEmailToUser({
        userId,
        content: emailContent,
        checkPreferences: false // Already checked above
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        emailSent: true,
        messageId: result.messageId,
        usedRealData: !!insights
      };
    });

    // Test 7: Scheduler Status
    await runTest(testResults, 'Email Scheduler Status', async () => {
      const allJobs = emailScheduler.getAllJobsStatus();
      const weeklyJob = emailScheduler.getJobStatus('weekly-insights');
      const monthlyJob = emailScheduler.getJobStatus('monthly-reports');
      const marketingJob = emailScheduler.getJobStatus('marketing-emails');

      return {
        totalJobs: allJobs.size,
        weeklyJobEnabled: weeklyJob?.enabled,
        monthlyJobEnabled: monthlyJob?.enabled,
        marketingJobEnabled: marketingJob?.enabled,
        schedulerEnabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true'
      };
    });

    // Test 8: Marketing Template (if opted in)
    await runTest(testResults, 'Marketing Email Template', async () => {
      const canSendMarketing = await emailService.canSendMarketingEmail(userId);

      const marketingData = {
        userName: user.name || 'Test User',
        campaignType: 'financial_tip' as const,
        subject: '💡 Test Financial Tip Email',
        content: {
          headline: 'Test Financial Wisdom',
          mainMessage: 'This is a test marketing email to verify our financial tip templates work correctly.',
          features: [
            'Test feature 1: Save money automatically',
            'Test feature 2: Track spending habits',
            'Test feature 3: Set realistic budgets'
          ],
          ctaText: 'View Your Dashboard',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
        }
      };

      const marketingEmail = EnhancedEmailTemplates.marketing.financialTip(marketingData);

      return {
        canSendMarketing,
        hasSubject: !!marketingEmail.subject,
        hasHtml: !!marketingEmail.html,
        hasText: !!marketingEmail.text,
        subject: marketingEmail.subject
      };
    });

    // Calculate summary
    const endTime = Date.now();
    testResults.summary.totalTests = testResults.results.length;
    testResults.summary.passedTests = testResults.results.filter(r => r.success).length;
    testResults.summary.failedTests = testResults.results.filter(r => !r.success).length;
    testResults.summary.totalDuration = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: `Email automation tests completed. ${testResults.summary.passedTests}/${testResults.summary.totalTests} tests passed.`,
      testResults
    });

  } catch (error: any) {
    console.error("Email automation test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to run email automation tests",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to run individual tests
 */
async function runTest(
  testResults: any,
  testName: string,
  testFunction: () => Promise<any>
): Promise<void> {
  const startTime = Date.now();

  try {
    const result = await testFunction();
    const duration = Date.now() - startTime;

    testResults.results.push({
      testName,
      success: true,
      duration,
      details: result
    });

    console.log(`✅ ${testName} - PASSED (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;

    testResults.results.push({
      testName,
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    console.log(`❌ ${testName} - FAILED (${duration}ms): ${error}`);
  }
}

/**
 * GET - Get quick status of email automation system
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    // Quick status checks
    const userData = await emailService.getUserData(userId);
    const schedulerStatus = emailScheduler.getAllJobsStatus();

    const status = {
      timestamp: new Date().toISOString(),
      userId: userId,
      userEmail: userData?.email,
      preferences: userData?.preferences,
      scheduler: {
        enabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true',
        totalJobs: schedulerStatus.size,
        jobsEnabled: Array.from(schedulerStatus.values()).filter(job => job.enabled).length
      },
      configuration: {
        hasResendApiKey: !!process.env.RESEND_API_KEY,
        hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
        hasNextPublicAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
        weeklyCron: process.env.WEEKLY_INSIGHTS_CRON,
        monthlyCron: process.env.MONTHLY_REPORTS_CRON,
        marketingCron: process.env.MARKETING_EMAILS_CRON
      }
    };

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error: any) {
    console.error("Email automation status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to get email automation status",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}