import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

type AuthUser = { $id?: string; id?: string };
type TxDoc = {
  amount?: string | number;
  bookingDate?: string;
};
type DocWithId = TxDoc & { $id?: string };
type BalanceDoc = {
  accountId?: string;
  balanceAmount?: string | number;
  referenceDate?: string;
  balanceType?: string;
};

const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9') as string;
const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id ?? user.id as string;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Helpers for date math in YYYY-MM-DD (UTC)
    const msDay = 24 * 60 * 60 * 1000;
    const toUTCDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
    const ymd = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
      const da = `${d.getUTCDate()}`.padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
    const addDays = (s: string, days: number) => ymd(new Date(toUTCDate(s).getTime() + days * msDay));

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

    // Build query filters for current period
    // Default to last 30 days if not provided
    const endStr = to || ymd(new Date());
    const startStr = from || addDays(endStr, -29);
    const lenDays = Math.floor((toUTCDate(endStr).getTime() - toUTCDate(startStr).getTime()) / msDay) + 1;
    const prevEndStr = addDays(startStr, -1);
    const prevStartStr = addDays(prevEndStr, -(lenDays - 1));

    const filters = [Query.equal("userId", userId),
                     Query.greaterThanEqual("bookingDate", startStr),
                     Query.lessThanEqual("bookingDate", endStr)];

    // Fetch transactions (paginate to include all rows in range)
    const baseQueries = [
      ...filters,
      Query.orderDesc("bookingDate"),
      Query.limit(100)
    ];
    let cursor: string | undefined = undefined;
    const transactions: TxDoc[] = [];
    while (true) {
      const q = [...baseQueries];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const resp = await databases.listDocuments(
        DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        q
      );
      const docs = resp.documents as DocWithId[];
      transactions.push(...docs);
      if (docs.length < 100) break;
      cursor = docs[docs.length - 1].$id;
      if (!cursor) break;
    }

    // Calculate metrics from transactions (current)
    // IMPORTANT: expenses is the sum of negative values (negative result)
    const income = transactions
      .map((t) => parseFloat(String(t.amount ?? 0)))
      .filter((v) => v > 0)
      .reduce((sum, v) => sum + v, 0);

    const expenses = transactions
      .map((t) => parseFloat(String(t.amount ?? 0)))
      .filter((v) => v < 0)
      .reduce((sum, v) => sum + v, 0); // negative number

    const netIncome = income + expenses; // since expenses is negative
    const savingsRate = income > 0 ? (netIncome / income) * 100 : 0;

    // Previous period transactions
    const prevFilters = [
      Query.equal("userId", userId),
      Query.greaterThanEqual("bookingDate", prevStartStr),
      Query.lessThanEqual("bookingDate", prevEndStr)
    ];
    const prevBase = [
      ...prevFilters,
      Query.orderDesc("bookingDate"),
      Query.limit(100)
    ];
    let prevCursor: string | undefined = undefined;
    const prevTxs: TxDoc[] = [];
    while (true) {
      const q = [...prevBase];
      if (prevCursor) q.push(Query.cursorAfter(prevCursor));
      const resp = await databases.listDocuments(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, q);
      const docs = resp.documents as DocWithId[];
      prevTxs.push(...docs);
      if (docs.length < 100) break;
      prevCursor = docs[docs.length - 1].$id;
      if (!prevCursor) break;
    }

    const prevIncome = prevTxs
      .map((t) => parseFloat(String(t.amount ?? 0)))
      .filter((v) => v > 0)
      .reduce((s, v) => s + v, 0);
    const prevExpensesNeg = prevTxs
      .map((t) => parseFloat(String(t.amount ?? 0)))
      .filter((v) => v < 0)
      .reduce((s, v) => s + v, 0);
    const prevNet = prevIncome + prevExpensesNeg;
    const prevSavingsRate = prevIncome > 0 ? (prevNet / prevIncome) * 100 : 0;

    // Fetch balances helper: latest per account at or before cutoff date
    const fetchBalancesTotalAt = async (cutoff: string) => {
      const resp = await databases.listDocuments(
      DATABASE_ID,
      BALANCES_COLLECTION_ID,
      [
        Query.equal("userId", userId),
        Query.equal("balanceType", "interimAvailable"),
        Query.lessThanEqual("referenceDate", cutoff),
        Query.orderDesc("referenceDate"),
        Query.limit(1000)
      ]
      );
      const seen = new Set<string>();
      let total = 0;
      for (const b of resp.documents as BalanceDoc[]) {
        const acct = String(b.accountId ?? "");
        if (acct && !seen.has(acct)) {
          seen.add(acct);
          total += parseFloat(String(b.balanceAmount ?? 0)) || 0;
        }
      }
      return total;
    };

    const totalBalance = await fetchBalancesTotalAt(endStr);
    const prevBalance = await fetchBalancesTotalAt(prevEndStr);

    // Delta percents
    const pct = (curr: number, prev: number) => (prev === 0 ? 0 : ((curr - prev) / prev) * 100);
    const deltas = {
      balancePct: pct(totalBalance, prevBalance),
      incomePct: pct(income, prevIncome),
      expensesPct: pct(Math.abs(expenses), Math.abs(prevExpensesNeg)),
      savingsPct: pct(savingsRate, prevSavingsRate),
    };

    return NextResponse.json({
      balance: totalBalance,
      income,
      expenses: Math.abs(expenses),
      netIncome,
      savingsRate,
      deltas,
      transactionCount: transactions.length
    });

  } catch (error: unknown) {
    console.error("Error fetching metrics:", error);
    const status = (error as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status }
    );
  }
}
