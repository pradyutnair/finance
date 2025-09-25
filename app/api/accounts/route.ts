import { NextRequest, NextResponse } from "next/server";
import { databases } from "@/lib/appwrite";
import { Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

const DATABASE_ID = "68d42ac20031b27284c9";
const BALANCES_COLLECTION_ID = "balances";
const BANK_ACCOUNTS_COLLECTION_ID = "bank_accounts";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user: any = await requireAuthUser(request);
    const userId = user.$id;

    // Fetch bank accounts
    const accountsResponse = await databases.listDocuments(
      DATABASE_ID,
      BANK_ACCOUNTS_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );

    // Fetch balances
    const balancesResponse = await databases.listDocuments(
      DATABASE_ID,
      BALANCES_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );

    // Create a map of account balances
    const balanceMap = new Map();
    balancesResponse.documents.forEach(balance => {
      balanceMap.set(balance.accountId, balance);
    });

    // Transform data to match frontend expectations
    const accounts = accountsResponse.documents.map(account => {
      const balance = balanceMap.get(account.accountId);
      
      return {
        id: account.accountId,
        name: account.accountName || "Unknown Account",
        type: account.type || "unknown",
        balance: balance?.balanceAmount || 0,
        currency: balance?.currency || "EUR",
        status: "active", // Bank accounts don't have status field
        lastSync: account.$updatedAt
      };
    });

    return NextResponse.json(accounts);

  } catch (error: any) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: error.status || 500 }
    );
  }
}
