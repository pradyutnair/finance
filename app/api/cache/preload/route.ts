export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases } from "appwrite";
import { preloadUserCache } from "@/lib/server/cache-service";

export async function POST(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request) as { $id?: string; id?: string };

    if (!user) {
      return NextResponse.json({ ok: false, error: "User not authenticated" }, { status: 401 });
    }

    const userId = user.$id || user.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invalid user ID" }, { status: 401 });
    }

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    
    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      (client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey };
    } else {
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token };
    }
    
    const databases = new Databases(client);

    console.log(`[Preload] Starting cache preload for user ${userId}`);
    
    // Preload user's data (365 days of transactions + balances)
    await preloadUserCache(userId, databases);
    
    return NextResponse.json({
      ok: true,
      message: "Cache preloaded successfully",
      userId
    });

  } catch (err: any) {
    console.error('Error preloading cache:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

