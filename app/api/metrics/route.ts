import { NextRequest, NextResponse } from "next/server";
import { Client, Databases } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { getUserTransactionCache, getUserBalanceCache, filterTransactions } from "@/lib/server/cache-service";

type AuthUser = { $id?: string; id?: string };

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

    // Default to last 30 days if not provided
    const endStr = to || ymd(new Date());
    const startStr = from || addDays(endStr, -29);
    const lenDays = Math.floor((toUTCDate(endStr).getTime() - toUTCDate(startStr).getTime()) / msDay) + 1;
    const prevEndStr = addDays(startStr, -1);
    const prevStartStr = addDays(prevEndStr, -(lenDays - 1));

    // Get cached transactions (loads 365 days on first call)
    const allTransactions = await getUserTransactionCache(userId, databases);
    
    // Filter transactions for current period
    const transactions = filterTransactions(allTransactions, {
      from: startStr,
      to: endStr,
      excludeExcluded: true
    });

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

    // Filter transactions for previous period
    const prevTxs = filterTransactions(allTransactions, {
      from: prevStartStr,
      to: prevEndStr,
      excludeExcluded: true
    });

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

    // Get cached balances
    const allBalances = await getUserBalanceCache(userId, databases);
    
    // Helper: get latest balance per account (always use most recent, not filtered by date)
    const getLatestBalanceTotal = () => {
      const relevantBalances = allBalances.filter(b => {
        const type = b.balanceType || '';
        return (type === 'interimAvailable' || type === 'expected');
      });
      
      // Get latest balance per account (most recent referenceDate)
      const accountBalances = new Map<string, { amount: number; date: string }>();
      for (const b of relevantBalances) {
        const acct = String(b.accountId || '');
        const refDate = b.referenceDate || '';
        if (!acct) continue;
        
        const existing = accountBalances.get(acct);
        if (!existing || refDate > existing.date) {
          accountBalances.set(acct, {
            amount: parseFloat(String(b.balanceAmount ?? 0)) || 0,
            date: refDate
          });
        }
      }
      
      let total = 0;
      for (const { amount } of accountBalances.values()) {
        total += amount;
      }
      return total;
    };

    // Always use latest balance (not filtered by date range) - sum of all accounts' latest balances
    const totalBalance = getLatestBalanceTotal();
    // For delta, balance doesn't change with date range, so use same value (delta will be 0)
    const prevBalance = totalBalance;

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
