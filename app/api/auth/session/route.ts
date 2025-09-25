export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { extractBearerToken, verifyAppwriteJWT } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const token = extractBearerToken(request);
    const { valid, user, error } = await verifyAppwriteJWT(token);
    if (!valid) {
      return NextResponse.json({ ok: false, error: error || "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal Server Error" },
      { status: err?.status || 500 }
    );
  }
}
