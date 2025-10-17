export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { sendEmailToUser, EmailTemplates } from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const body = await request.json();

    const {
      type,
      customContent,
      recipientUserId,
      config,
      checkPreferences = true
    } = body;

    // Validate required fields
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
          emailContent = EmailTemplates.welcome(user?.name);
          break;
        case 'monthly_report':
          emailContent = EmailTemplates.monthlyReport(user?.name, body.month);
          break;
        case 'budget_alert':
          if (!body.category || !body.spent || !body.budget) {
            return NextResponse.json(
              { ok: false, error: "Budget alert requires 'category', 'spent', and 'budget' fields" },
              { status: 400 }
            );
          }
          emailContent = EmailTemplates.budgetAlert(
            body.category,
            body.spent,
            body.budget,
            user?.name
          );
          break;
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

    // Send email
    const result = await sendEmailToUser({
      userId: recipientUserId || (user as any)?.$id,
      content: emailContent,
      config,
      checkPreferences
    });

    if (result.success) {
      return NextResponse.json({
        ok: true,
        message: "Email sent successfully",
        messageId: result.messageId
      });
    } else {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send email" },
      { status: err?.status || 500 }
    );
  }
}