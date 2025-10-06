export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { invalidateUserCache } from "@/lib/server/cache-service";

export async function POST(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request) as { $id?: string; id?: string };
    const userId = user.$id || user.id;

    const globalAny = globalThis as any;
    const clearedCaches = [];
    
    // Clear global caches
    if (globalAny.__tx_cache) {
      const size = globalAny.__tx_cache.size;
      globalAny.__tx_cache.clear();
      clearedCaches.push(`__tx_cache (${size} entries)`);
    }
    if (globalAny.__acct_cache) {
      const size = globalAny.__acct_cache.size;
      globalAny.__acct_cache.clear();
      clearedCaches.push(`__acct_cache (${size} entries)`);
    }
    if (globalAny.__acct_tx_cache) {
      const size = globalAny.__acct_tx_cache.size;
      globalAny.__acct_tx_cache.clear();
      clearedCaches.push(`__acct_tx_cache (${size} entries)`);
    }

    // Clear centralized user cache
    if (userId) {
      invalidateUserCache(userId, 'all');
      clearedCaches.push('user_cache (transactions & balances)');
    }
    
    // Note: Some in-memory caches (budgetsCache, goalsCache) 
    // are module-level and cannot be cleared without restarting the server

    return NextResponse.json({
      ok: true,
      message: "API caches cleared successfully",
      clearedCaches,
      note: "Some in-memory caches require server restart to clear completely"
    });

  } catch (err: any) {
    console.error('Error clearing cache:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    // Require authenticated user
    await requireAuthUser(request);

    const globalAny = globalThis as any;
    
    // Get cache status
    const cacheStatus = {
      txCache: globalAny.__tx_cache ? globalAny.__tx_cache.size : 0,
      acctCache: globalAny.__acct_cache ? globalAny.__acct_cache.size : 0,
      acctTxCache: globalAny.__acct_tx_cache ? globalAny.__acct_tx_cache.size : 0,
    };

    return NextResponse.json({
      ok: true,
      message: "Cache status retrieved",
      cacheStatus,
      instructions: {
        clearApiCache: "POST to /api/clear-cache to clear all API caches",
        clearBrowserCache: "Use browser dev tools or hard refresh (Cmd+Shift+R / Ctrl+Shift+R)",
        restartServer: "Restart your development server to clear all in-memory caches"
      }
    });

  } catch (err: any) {
    console.error('Error getting cache status:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
