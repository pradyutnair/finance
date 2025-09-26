export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unauthorized" },
      { status: err?.status || 401 }
    );
  }
}
