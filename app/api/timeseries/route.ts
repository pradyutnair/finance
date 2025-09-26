import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

type AuthUser = { $id?: string; id?: string };
type TxDoc = { amount?: string | number; bookingDate?: string; valueDate?: string };

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
      [
        ...filters,
        Query.orderDesc("bookingDate"),
        Query.limit(1000) // Limit for performance
      ]
    );

    const transactions = transactionsResponse.documents as TxDoc[];

    // Group transactions by week
    const weeklyData = new Map();

    transactions.forEach((transaction) => {
      const date = new Date(String(transaction.bookingDate || transaction.valueDate));
      // Get the start of the week (Sunday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { income: 0, expenses: 0 });
      }

      const weekData = weeklyData.get(weekKey);
      const amount = parseFloat(String(transaction.amount ?? 0));
      if (amount > 0) {
        weekData.income += amount;
      } else {
        weekData.expenses += Math.abs(amount);
      }
    });

    // Convert to array and sort by date
    const timeseriesData = Array.from(weeklyData.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        income: Math.round(data.income * 100) / 100,
        expenses: Math.round(data.expenses * 100) / 100
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8); // Last 8 weeks

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
