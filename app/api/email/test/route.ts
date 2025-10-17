export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailService, EmailTemplates } from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const body = await request.json();
    const { testType = 'template', recipientEmail, templateType = 'welcome' } = body;

    console.log(`🧪 Testing email functionality with ${testType} test`);

    // Test 1: Get user data
    const userData = await emailService.getUserData((user as any)?.$id);
    if (!userData) {
      return NextResponse.json(
        { ok: false, error: "Could not retrieve user data for testing" },
        { status: 404 }
      );
    }

    console.log("✅ User data retrieved:", { userId: userData.userId, email: userData.email, name: userData.name });

    // Test 2: Email template generation
    let emailContent;
    switch (templateType) {
      case 'welcome':
        emailContent = EmailTemplates.welcome(userData.name);
        break;
      case 'monthly_report':
        emailContent = EmailTemplates.monthlyReport(userData.name);
        break;
      case 'budget_alert':
        emailContent = EmailTemplates.budgetAlert('Food & Dining', 450, 500, userData.name);
        break;
      default:
        return NextResponse.json(
          { ok: false, error: `Unknown template type for test: ${templateType}` },
          { status: 400 }
        );
    }

    console.log("✅ Email template generated successfully");

    // Test 3: Send email (if environment variables are configured)
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        ok: true,
        message: "Email service test completed (dry run - no RESEND_API_KEY configured)",
        tests: {
          userDataRetrieved: true,
          templateGenerated: true,
          emailSent: false,
          reason: "RESEND_API_KEY not configured"
        },
        userData: {
          userId: userData.userId,
          email: userData.email,
          name: userData.name,
          preferences: userData.preferences
        },
        templatePreview: {
          subject: emailContent.subject,
          hasHtml: !!emailContent.html,
          hasText: !!emailContent.text
        }
      });
    }

    const result = await emailService.sendEmailToUser({
      userId: (user as any)?.$id,
      content: emailContent,
      checkPreferences: false // Override preferences for testing
    });

    console.log(result.success ? "✅ Email sent successfully" : "❌ Email send failed");

    return NextResponse.json({
      ok: true,
      message: result.success ? "Email test completed successfully" : "Email test completed with errors",
      tests: {
        userDataRetrieved: true,
        templateGenerated: true,
        emailSent: result.success,
        messageId: result.messageId
      },
      userData: {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        preferences: userData.preferences
      },
      templatePreview: {
        subject: emailContent.subject,
        hasHtml: !!emailContent.html,
        hasText: !!emailContent.text
      },
      error: result.error
    });
  } catch (err: any) {
    console.error("❌ Email test failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Email test failed",
        details: {
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
          stack: err.stack
        }
      },
      { status: err?.status || 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthUser(request);

    return NextResponse.json({
      ok: true,
      message: "Email service test endpoint",
      usage: {
        method: "POST",
        body: {
          testType: "template | direct",
          templateType: "welcome | monthly_report | budget_alert",
          recipientEmail: "string (optional)"
        }
      },
      configuration: {
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
        resendFromEmail: process.env.RESEND_FROM_EMAIL
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Authentication failed" },
      { status: err?.status || 500 }
    );
  }
}