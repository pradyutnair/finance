import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

type AuthUser = { $id?: string; id?: string };
type TxDoc = { amount?: string | number; category?: string; bookingDate?: string };

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

    // Build query filters for expenses only
    const filters = [
      Query.equal("userId", userId),
      Query.lessThan("amount", "0") // Only expenses (string comparison)
    ];
    
    if (from && to) {
      filters.push(Query.greaterThanEqual("bookingDate", from));
      filters.push(Query.lessThanEqual("bookingDate", to));
    }

    // Fetch expense transactions
    const transactionsResponse = await databases.listDocuments(
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      filters
    );

    const transactions = transactionsResponse.documents as TxDoc[];

    // Group by category
    const categoryData = new Map();
    let totalExpenses = 0;

    transactions.forEach((transaction) => {
      const category = transaction.category || "Uncategorized";
      const amount = Math.abs(parseFloat(String(transaction.amount ?? 0)) || 0);
      totalExpenses += amount;

      if (!categoryData.has(category)) {
        categoryData.set(category, 0);
      }
      categoryData.set(category, categoryData.get(category) + amount);
    });

    // Convert to array and calculate percentages
    const categoriesData = Array.from(categoryData.entries())
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        percent: Math.round((amount / totalExpenses) * 100 * 100) / 100
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 categories

    return NextResponse.json(categoriesData);

  } catch (error: unknown) {
    console.error("Error fetching categories data:", error);
    const status = (error as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: "Failed to fetch categories data" },
      { status }
    );
  }
}
