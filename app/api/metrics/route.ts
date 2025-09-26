import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

type AuthUser = { $id?: string; id?: string };
type TxDoc = {
  amount?: string | number;
  bookingDate?: string;
};
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

    // Build query filters
    const filters = [Query.equal("userId", userId)];
    
    if (from && to) {
      filters.push(Query.greaterThanEqual("bookingDate", from));
      filters.push(Query.lessThanEqual("bookingDate", to));
    }

    // Fetch transactions
    const transactionsResponse = await databases.listDocuments(
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      filters
    );

    const transactions = transactionsResponse.documents as TxDoc[];

    // Calculate metrics from transactions
    const income = transactions
      .filter((t) => parseFloat(String(t.amount ?? 0)) > 0)
      .reduce((sum, t) => sum + parseFloat(String(t.amount ?? 0)), 0);

    const expenses = Math.abs(
      transactions
        .filter((t) => parseFloat(String(t.amount ?? 0)) < 0)
        .reduce((sum, t) => sum + parseFloat(String(t.amount ?? 0)), 0)
    );

    const netIncome = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Fetch current balances with interimAvailable type only (per specs)
    // Get latest snapshot per account (order by referenceDate desc)
    const balancesResponse = await databases.listDocuments(
      DATABASE_ID,
      BALANCES_COLLECTION_ID,
      [
        Query.equal("userId", userId),
        Query.equal("balanceType", "interimAvailable"),
        Query.orderDesc("referenceDate"),
        Query.limit(1000)
      ]
    );

    const seenAccounts = new Set<string>();
    let totalBalance = 0;
    for (const b of balancesResponse.documents as BalanceDoc[]) {
      const acct = String(b.accountId ?? "");
      if (acct && !seenAccounts.has(acct)) {
        seenAccounts.add(acct);
        totalBalance += parseFloat(String(b.balanceAmount ?? 0)) || 0;
      }
    }

    return NextResponse.json({
      balance: totalBalance,
      income,
      expenses,
      netIncome,
      savingsRate,
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
