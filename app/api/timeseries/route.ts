import { NextRequest, NextResponse } from "next/server";
import { databases } from "@/lib/appwrite";
import { Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

const DATABASE_ID = "68d42ac20031b27284c9";
const TRANSACTIONS_COLLECTION_ID = "transactions";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user: any = await requireAuthUser(request);
    const userId = user.$id;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

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

    const transactions = transactionsResponse.documents;

    // Group transactions by week
    const weeklyData = new Map();

    transactions.forEach(transaction => {
      const date = new Date(transaction.bookingDate);
      // Get the start of the week (Sunday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, { income: 0, expenses: 0 });
      }

      const weekData = weeklyData.get(weekKey);
      if (transaction.amount > 0) {
        weekData.income += transaction.amount;
      } else {
        weekData.expenses += Math.abs(transaction.amount);
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

  } catch (error: any) {
    console.error("Error fetching timeseries data:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeseries data" },
      { status: error.status || 500 }
    );
  }
}
