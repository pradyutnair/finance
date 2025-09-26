export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
    if (apiKey) {
      // Use server key via header (supported by Web SDK on server runtime)
      (client as any).headers = { ...(client as any).headers, 'X-Appwrite-Key': apiKey };
    } else {
      // Fallback to JWT from the current session if available
      const auth = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
      if (token) (client as any).headers = { ...(client as any).headers, 'X-Appwrite-JWT': token };
    }
    const databases = new Databases(client);

    const DATABASE_ID = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9') as string;
    const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

    // Build query
    const queries = [Query.equal('userId', userId)];
    if (accountId) {
      queries.push(Query.equal('accountId', accountId));
    }
    
    // Add date range filtering
    if (from && to) {
      queries.push(Query.greaterThanEqual("bookingDate", from));
      queries.push(Query.lessThanEqual("bookingDate", to));
    }
    
    // Add ordering by booking date (newest first)
    queries.push(Query.orderDesc('bookingDate'));
    queries.push(Query.limit(limit));
    queries.push(Query.offset(offset));

    // Get user's transactions
    const transactionsResponse = await databases.listDocuments(
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      queries
    );

    return NextResponse.json({
      ok: true,
      transactions: transactionsResponse.documents,
      total: transactionsResponse.total
    });

  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}