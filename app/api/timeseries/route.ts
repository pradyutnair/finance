import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

type AuthUser = { $id?: string; id?: string };
type TxDoc = { amount?: string | number; bookingDate?: string; valueDate?: string };
type DocWithId = TxDoc & { $id?: string };

const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9') as string;
const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id ?? user.id as string;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Date helpers
    const msDay = 24 * 60 * 60 * 1000;
    const toUTCDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
    const ymd = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
      const da = `${d.getUTCDate()}`.padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
    const addDays = (s: string, days: number) => ymd(new Date(toUTCDate(s).getTime() + days * msDay));
    const endStr = to || ymd(new Date());
    const startStr = from || addDays(endStr, -29);

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

    // Fetch transactions for the range with pagination
    const base = [
      Query.equal("userId", userId),
      Query.greaterThanEqual("bookingDate", startStr),
      Query.lessThanEqual("bookingDate", endStr),
      Query.orderAsc("bookingDate"),
      Query.limit(100)
    ];
    let cursor: string | undefined = undefined;
    const txs: TxDoc[] = [];
    while (true) {
      const q = [...base];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const resp = await databases.listDocuments(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, q);
      const docs = resp.documents as DocWithId[];
      txs.push(...docs);
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
      if (!cursor) break;
    }

    // Initialize daily buckets (ensure continuous dates)
    const daily: Record<string, { income: number; expenses: number }> = {};
    let d = toUTCDate(startStr);
    const end = toUTCDate(endStr);
    while (d.getTime() <= end.getTime()) {
      daily[ymd(d)] = { income: 0, expenses: 0 };
      d = new Date(d.getTime() + msDay);
    }

    // Accumulate
    for (const t of txs) {
      const day = String(t.bookingDate || t.valueDate);
      if (!day || !daily[day]) continue;
      const amt = parseFloat(String(t.amount ?? 0));
      if (amt > 0) daily[day].income += amt;
      else daily[day].expenses += Math.abs(amt);
    }

    const timeseriesData = Object.entries(daily)
      .map(([date, v]) => ({ date, income: Number(v.income.toFixed(2)), expenses: Number(v.expenses.toFixed(2)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(timeseriesData);

  } catch (error: unknown) {
    console.error("Error fetching timeseries data:", error);
    const status = (error as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: "Failed to fetch timeseries data" },
      { status }
    );
  }
}
