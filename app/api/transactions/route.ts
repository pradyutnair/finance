export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const isAll = ["1", "true", "yes"].includes((searchParams.get("all") || "").toLowerCase());
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));
    const searchTermRaw = searchParams.get("search");
    const searchTerm = searchTermRaw ? searchTermRaw.trim() : "";

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      // Use server key via header (supported by Web SDK on server runtime)
      (client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey };
    } else {
      // Fallback to JWT from the current session if available
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token };
    }
    const databases = new Databases(client);

    const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9') as string;
    const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

    // Helper functions for fuzzy search
    const tokenize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    const levenshtein = (a: string, b: string) => {
      const m = a.length;
      const n = b.length;
      if (!m) return n;
      if (!n) return m;
      const prev = new Array(n + 1).fill(0);
      const curr = new Array(n + 1).fill(0);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(
            curr[j - 1] + 1,
            prev[j] + 1,
            prev[j - 1] + cost
          );
        }
        for (let j = 0; j <= n; j++) prev[j] = curr[j];
      }
      return prev[n];
    };

    const hasSearch = Boolean(searchTerm);
    const tokens = hasSearch ? tokenize(searchTerm) : [];
    const fuzzyEnabled = hasSearch && searchTerm.length <= 40;

    const scoreText = (text: string) => {
      if (!hasSearch) return 0;
      const hay = tokenize(text);
      if (!hay.length) return 0;
      let score = 0;
      for (const token of tokens) {
        let matched = false;
        for (const word of hay) {
          if (word.includes(token)) {
            score += 3;
            matched = true;
            break;
          }
        }
        if (matched) continue;
        if (!fuzzyEnabled) continue;
        for (const word of hay) {
          if (Math.abs(word.length - token.length) > 2) continue;
          if (levenshtein(word, token) <= 2) {
            score += 1;
            matched = true;
            break;
          }
        }
      }
      return score;
    };

    // Build base queries
    const baseQueries = [Query.equal('userId', userId)] as any[];
    if (accountId) {
      baseQueries.push(Query.equal('accountId', accountId));
    }
    // IMPORTANT: Do not add date filters at the DB level, because some docs
    // use `date` instead of `bookingDate`. We'll filter by date in-memory
    // on the combined field below to avoid excluding valid documents.
    baseQueries.push(Query.orderDesc('bookingDate'));

    // Server response caching disabled to avoid stale results during debugging

    const hasDateRange = Boolean(from && to);
    const needsPostFilter = hasSearch || hasDateRange;

    // Fast path: only when we don't need post-filtering and not requesting all
    if (!needsPostFilter && !isAll) {
      const page = await databases.listDocuments(
        DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        [...baseQueries, Query.limit(limit), Query.offset(offset)] as any
      );

      const payload = {
        ok: true,
        transactions: (page as any).documents || [],
        total: typeof (page as any).total === 'number' ? (page as any).total : ((page as any).documents || []).length,
      };
      return NextResponse.json(payload);
    }

    // Fetch documents with cursor pagination (we collect enough for filtering/paging)
    const docs: any[] = [];
    let cursor: string | undefined;
    let firstPageTotal: number | undefined;
    const maxFetch = isAll ? Number.MAX_SAFE_INTEGER : (needsPostFilter ? Math.max(offset + limit, 400) : offset + limit);
    const hardCap = isAll ? 10000 : (needsPostFilter ? 1000 : 400);
    while (docs.length < Math.min(maxFetch, hardCap)) {
      const remaining = Math.min(100, Math.min(maxFetch, hardCap) - docs.length);
      const q = [...baseQueries, Query.limit(remaining)] as any[];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const page = await databases.listDocuments(
        DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        q
      );
      if (firstPageTotal === undefined && typeof (page as any).total === "number") {
        firstPageTotal = (page as any).total as number;
      }
      const pageDocs = page.documents as any[];
      docs.push(...pageDocs);
      if (pageDocs.length < remaining) break;
      cursor = pageDocs[pageDocs.length - 1]?.$id;
      if (!cursor) break;
    }

    let filtered = docs;
    if (hasSearch) {
      filtered = docs
        .map(doc => {
          const text = `${doc.description || ''} ${doc.counterparty || ''}`;
          const score = scoreText(text);
          return { doc, score, ts: doc.bookingDate || doc.date || doc.$createdAt };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const ta = a.ts || '';
          const tb = b.ts || '';
          return tb.localeCompare(ta);
        })
        .map(item => item.doc);
    }

    // Post-filter by date range if provided, using `bookingDate || date`
    if (hasDateRange) {
      const fromIso = from as string;
      const toIso = to as string;
      filtered = filtered
        .filter(doc => {
          const d = (doc.bookingDate || doc.date || '').slice(0, 10);
          if (!d) return false;
          return d >= fromIso && d <= toIso;
        })
        .sort((a, b) => {
          const ta = (a.bookingDate || a.date || '') as string;
          const tb = (b.bookingDate || b.date || '') as string;
          return tb.localeCompare(ta);
        });
    }

    const totalBase = typeof firstPageTotal === 'number' ? firstPageTotal : docs.length;
    const total = needsPostFilter ? filtered.length : totalBase;
    // Always return a page slice to keep client-side pagination consistent,
    // while still computing accurate totals when `all` is set.
    const paged = filtered.slice(offset, offset + limit);

    const payload = {
      ok: true,
      transactions: paged,
      total,
    };

    return NextResponse.json(payload);

  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}