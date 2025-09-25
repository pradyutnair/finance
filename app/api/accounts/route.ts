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

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    
    client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
    const databases = new Databases(client);

    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
    const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';

    // Get user's bank accounts
    const accountsResponse = await databases.listDocuments(
      DATABASE_ID,
      BANK_ACCOUNTS_COLLECTION_ID,
      [Query.equal('userId', userId)]
    );

    return NextResponse.json({
      ok: true,
      accounts: accountsResponse.documents
    });

  } catch (err: any) {
    console.error('Error fetching accounts:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}