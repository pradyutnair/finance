export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { Client, Databases } from "appwrite";
import { requireAuthUser } from "@/lib/auth";
import { getUserTransactionCache, filterTransactions } from "@/lib/server/cache-service";
import { logger } from "@/lib/logger";
type AuthUser = { $id?: string; id?: string };

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = (await requireAuthUser(request)) as AuthUser;
    const userId = user.$id ?? user.id as string;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    
    // Create Appwrite client for cache service
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

    // Get cached transactions (loads 365 days on first call)
    const allTransactions = await getUserTransactionCache(userId, databases);
    
    // Filter for expenses only within date range
    const transactions = filterTransactions(allTransactions, {
      from,
      to,
      excludeExcluded: true
    }).filter(t => {
      const amount = parseFloat(String(t.amount ?? 0));
      return amount < 0; // Only expenses
    });

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
        percent: totalExpenses > 0
          ? Math.round((amount / totalExpenses) * 100 * 100) / 100
          : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json(categoriesData);

  } catch (error: unknown) {
    logger.error("Error fetching categories data", { error: error instanceof Error ? error.message : String(error) });
    const status = (error as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: "Failed to fetch categories data" },
      { status }
    );
  }
}
