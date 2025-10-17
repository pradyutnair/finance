export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { EmailTemplates } from "@/lib/email-service";

export async function GET(request: Request) {
  try {
    await requireAuthUser(request); // Just to ensure authentication
    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('type');
    const userName = searchParams.get('userName');
    const month = searchParams.get('month');
    const category = searchParams.get('category');
    const spent = searchParams.get('spent');
    const budget = searchParams.get('budget');

    let template;

    switch (templateType) {
      case 'welcome':
        template = EmailTemplates.welcome(userName || undefined);
        break;
      case 'monthly_report':
        template = EmailTemplates.monthlyReport(userName || undefined, month || undefined);
        break;
      case 'budget_alert':
        if (!category || !spent || !budget) {
          return NextResponse.json(
            { ok: false, error: "Budget alert template requires 'category', 'spent', and 'budget' parameters" },
            { status: 400 }
          );
        }
        template = EmailTemplates.budgetAlert(
          category,
          parseFloat(spent),
          parseFloat(budget),
          userName || undefined
        );
        break;
      default:
        return NextResponse.json(
          { ok: false, error: `Unknown template type: ${templateType}. Available: welcome, monthly_report, budget_alert` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ok: true,
      template,
      type: templateType
    });
  } catch (err: any) {
    console.error("Get template error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to get template" },
      { status: err?.status || 500 }
    );
  }
}