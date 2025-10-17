export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { emailService } from "@/lib/email-service";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || (user as any)?.$id;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user data including email and preferences
    const userData = await emailService.getUserData(userId);

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      userData: {
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        preferences: userData.preferences
      }
    });
  } catch (err: any) {
    console.error("Get user data error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to get user data" },
      { status: err?.status || 500 }
    );
  }
}