export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import OpenAI from "openai";

type AuthUser = { $id?: string; id?: string };

const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "68d42ac20031b27284c9") as string;
const TX_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || "transactions_dev";
const BUDGETS_COLLECTION_ID = process.env.APPWRITE_BUDGETS_COLLECTION_ID || "preferences_budgets_dev";

// Streaming + tool-calling route. The model decides what to fetch via tools.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userMessage: string = body?.message || "";
    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
    }

    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = (user.$id ?? user.id) as string;

    // Appwrite client (server-side)
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    // Use JWT token from Authorization header (same as other API routes)
    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (token) {
      client.setJWT(token);
    } else {
      const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
      if (apiKey) {
        (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
      } else {
        throw new Error("No authentication provided");
      }
    }
    const databases = new Databases(client);

    // Tool implementation the model can call
    function tokenize(s: string): string[] {
      return s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
    }

    function levenshtein(a: string, b: string): number {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }
      return dp[m][n];
    }

    function fuzzyMatch(text: string, query: string, mode: 'any' | 'all' = 'any', enableFuzzy = true): boolean {
      const hay = tokenize(text);
      const q = tokenize(query);
      if (q.length === 0) return true;
      let matched = 0;
      for (const token of q) {
        const hasExact = hay.some(w => w.includes(token));
        if (hasExact) {
          matched++;
          continue;
        }
        if (enableFuzzy) {
          const near = hay.some(w => {
            if (Math.abs(w.length - token.length) > 2) return false;
            return levenshtein(w, token) <= 2;
          });
          if (near) matched++;
        }
      }
      if (mode === 'all') return matched === q.length;
      return matched > 0;
    }

    async function queryTransactionsTool(args: any) {
      const msDay = 24 * 60 * 60 * 1000;
      const ymd = (d: Date) => `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, "0")}-${`${d.getUTCDate()}`.padStart(2, "0")}`;
      const now = new Date();
      const days = Math.max(1, Math.min(365, Number(args?.days) || 60));
      const fromStr = typeof args?.from === "string" ? args.from : ymd(new Date(now.getTime() - (days - 1) * msDay));
      const toStr = typeof args?.to === "string" ? args.to : ymd(now);
      const limit = Math.max(1, Math.min(300, Number(args?.limit) || 150));
      const category = typeof args?.category === "string" ? args.category : undefined;
      const search = typeof args?.search === "string" ? args.search : undefined;
      const searchMode: 'any' | 'all' = args?.searchMode === 'all' ? 'all' : 'any';
      const fuzzy = args?.fuzzy !== false; // default true
      const accountId = typeof args?.accountId === "string" ? args.accountId : undefined;

      const base = [
        Query.equal("userId", userId),
        Query.greaterThanEqual("bookingDate", fromStr),
        Query.lessThanEqual("bookingDate", toStr),
        Query.or([Query.equal("exclude", false), Query.isNull("exclude")]),
        Query.orderDesc("bookingDate"),
      ];
      if (category) base.push(Query.equal("category", category));
      if (accountId) base.push(Query.equal("accountId", accountId));

      type TxDoc = { $id?: string; amount?: string | number; currency?: string; bookingDate?: string; description?: string; counterparty?: string; category?: string | null };
      let txs: TxDoc[] = [];
      let cursor: string | undefined = undefined;
      while (txs.length < limit) {
        const pageLimit = Math.min(100, limit - txs.length);
        const q = [...base, Query.limit(pageLimit)];
        if (cursor) q.push(Query.cursorAfter(cursor));
        const page = await databases.listDocuments(DATABASE_ID, TX_COLLECTION_ID, q);
        const docs = page.documents as TxDoc[];
        txs.push(...docs);
        if (docs.length < pageLimit) break;
        cursor = docs[docs.length - 1]?.$id;
        if (!cursor) break;
      }

      // If search provided but no fulltext index, filter in memory (case-insensitive)
      if (search) {
        const q = String(search);
        txs = txs.filter(t => {
          const text = `${t.description || ''} ${t.counterparty || ''}`;
          return fuzzyMatch(text, q, searchMode, fuzzy);
        });
      }

      const round2 = (n: number) => Number(n.toFixed(2));
      let income = 0, expenses = 0;
      const byCat: Record<string, number> = {};
      for (const t of txs) {
        const amt = Number(t.amount ?? 0);
        if (!Number.isFinite(amt)) continue;
        if (amt >= 0) income += amt; else expenses += Math.abs(amt);
        const cat = (t.category || "Uncategorized").toString();
        byCat[cat] = (byCat[cat] || 0) + amt;
      }
      const cats = Object.entries(byCat).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([n,a])=>[n, round2(a)]);
      const sample = txs.slice(0, 30).map(t => ({ d: t.bookingDate, a: Number(t.amount ?? 0), c: t.category || null, p: t.counterparty || null, s: t.description || null }));
      const cur = txs.find(t=>t.currency)?.currency || "";
      return { from: fromStr, to: toStr, cur, inc: round2(income), exp: round2(expenses), net: round2(income-expenses), cats, sample };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5-nano";

    const tools: any = [
      {
        type: "function",
        function: {
          name: "query_transactions",
          description: "Query user transactions and return a compact summary.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "integer", minimum: 1, maximum: 365 },
              from: { type: "string" },
              to: { type: "string" },
              category: { type: "string" },
              search: { type: "string" },
              accountId: { type: "string" },
              limit: { type: "integer", minimum: 1, maximum: 300 }
            }
          }
        }
      }
    ];

    // Let model decide to call tools
    const first = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a concise finance assistant. Use tools to fetch data as needed." },
        { role: "user", content: userMessage }
      ],
      tools: tools as any
    });

    const choice = first.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;
    const msgs: Array<any> = [
      { role: "system", content: "You are a concise finance assistant." },
      { role: "user", content: userMessage }
    ];
    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc.type === "function" && tc.function?.name === "query_transactions") {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const result = await queryTransactionsTool(args);
          // Reflect assistant tool call with proper metadata
          msgs.push({
            role: "assistant",
            tool_calls: [
              {
                id: tc.id,
                type: "function",
                function: { name: "query_transactions", arguments: JSON.stringify(args) }
              }
            ]
          });
          // Provide tool result
          msgs.push({ role: "tool", tool_call_id: tc.id, name: "query_transactions", content: JSON.stringify(result) });
        }
      }
    }

    // Stream final answer (SSE)
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (s: string) => controller.enqueue(encoder.encode(`data: ${s}\n\n`));
        try {
          const completion = await openai.chat.completions.create({ model, messages: msgs as any, tools: tools as any, stream: true });
          for await (const part of completion) {
            const delta = part.choices?.[0]?.delta?.content;
            if (delta) send(delta);
          }
          send("[DONE]");
          controller.close();
        } catch (err: any) {
          // Fallback: try a quick heuristic answer to avoid total failure
          try {
            const fallback = await queryTransactionsTool({ days: 31, search: /cab|uber|lyft/i.test(userMessage) ? "cab" : undefined, limit: 150 });
            const lines: string[] = [];
            lines.push("Here’s a quick summary:");
            const count = Array.isArray(fallback.sample) ? fallback.sample.filter((t:any)=> t.a > 0).length : 0;
            lines.push(`- Payments count: ${count}`);
            if (fallback.cats?.length) lines.push(`- Top categories: ${fallback.cats.slice(0,3).map((c:any)=>`${c[0]} ${Math.round(Math.abs(c[1]))}`).join(', ')}`);
            const text = lines.join("\n");
            send(text);
            send("[DONE]");
            controller.close();
          } catch (_e) {
            send(`ERROR: ${err?.message || "stream failed"}`);
            controller.close();
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error: any) {
    console.error("AI chat route error:", error);
    const status = error?.status || 500;
    return NextResponse.json({ ok: false, error: error?.message || "Internal Server Error" }, { status });
  }
}


