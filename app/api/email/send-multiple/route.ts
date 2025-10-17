export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { sendEmailToMultipleUsers, EmailTemplates } from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const body = await request.json();

    const {
      userIds,
      type,
      customContent,
      config
    } = body;

    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "userIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!type && !customContent) {
      return NextResponse.json(
        { ok: false, error: "Either 'type' or 'customContent' must be provided" },
        { status: 400 }
      );
    }

    let emailContent;

    // Use template if type is provided
    if (type) {
      switch (type) {
        case 'welcome':
          emailContent = EmailTemplates.welcome();
          break;
        case 'monthly_report':
          emailContent = EmailTemplates.monthlyReport(undefined, body.month);
          break;
        case 'budget_alert':
          return NextResponse.json(
            { ok: false, error: "Budget alert template not supported for bulk sending" },
            { status: 400 }
          );
        default:
          return NextResponse.json(
            { ok: false, error: `Unknown email template type: ${type}` },
            { status: 400 }
          );
      }
    } else if (customContent) {
      // Use custom content
      emailContent = customContent;

      // Validate custom content structure
      if (!emailContent.subject || (!emailContent.html && !emailContent.text)) {
        return NextResponse.json(
          { ok: false, error: "Custom content must include 'subject' and either 'html' or 'text'" },
          { status: 400 }
        );
      }
    }

    // Send emails to multiple users
    const result = await sendEmailToMultipleUsers(userIds, emailContent, config);

    return NextResponse.json({
      ok: result.success,
      message: `Processed ${result.results.length} emails`,
      results: result.results,
      successCount: result.results.filter(r => r.success).length,
      failureCount: result.results.filter(r => !r.success).length
    });
  } catch (err: any) {
    console.error("Bulk email send error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send bulk emails" },
      { status: err?.status || 500 }
    );
  }
}