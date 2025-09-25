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
    
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const category = searchParams.get("category");
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build query filters
    const filters = [Query.equal("userId", userId)];
    
    if (category) {
      filters.push(Query.equal("category", category));
    }
    
    if (accountId) {
      filters.push(Query.equal("accountId", accountId));
    }
    
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
        Query.limit(limit),
        Query.offset(offset)
      ]
    );

    // Transform data to match frontend expectations
    const transactions = transactionsResponse.documents.map(doc => ({
      id: doc.$id,
      date: doc.bookingDate,
      merchant: doc.counterparty || "Unknown",
      description: doc.description || "",
      category: doc.category || "Uncategorized",
      amount: doc.amount,
      currency: doc.currency,
      accountId: doc.accountId
    }));

    return NextResponse.json({
      transactions,
      total: transactionsResponse.total
    });

  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: error.status || 500 }
    );
  }
}
