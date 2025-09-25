import { NextRequest, NextResponse } from "next/server";
import { Client, Databases, Query } from "appwrite";
import { requireAuthUser } from "@/lib/auth";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user: any = await requireAuthUser(request);
    const userId = user.$id;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    
    client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
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

    const transactions = transactionsResponse.documents;

    // Calculate metrics
    const income = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = Math.abs(transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));

    const netIncome = income - expenses;
    const savingsRate = expenses > 0 ? (netIncome / expenses) * 100 : 0;

    // Fetch current balances
    const balancesResponse = await databases.listDocuments(
      DATABASE_ID,
      BALANCES_COLLECTION_ID,
      [Query.equal("userId", userId)]
    );

    const totalBalance = balancesResponse.documents.reduce(
      (sum, balance) => sum + (balance.balanceAmount || 0), 0
    );

    return NextResponse.json({
      balance: totalBalance,
      income,
      expenses,
      netIncome,
      savingsRate,
      transactionCount: transactions.length
    });

  } catch (error: any) {
    console.error("Error fetching metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: error.status || 500 }
    );
  }
}
