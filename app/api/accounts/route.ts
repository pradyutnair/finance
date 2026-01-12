export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { APPWRITE_CONFIG, COLLECTIONS } from "@/lib/config";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user: any = await requireAuthUser(request);
    const userId = user.$id || user.id;

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
    
    const apiKey = APPWRITE_CONFIG.apiKey;
    if (apiKey) {
      client.headers['X-Appwrite-Key'] = apiKey;
    }
    const databases = new Databases(client);

    const DATABASE_ID = APPWRITE_CONFIG.databaseId;
    const BANK_ACCOUNTS_COLLECTION_ID = COLLECTIONS.bankAccounts;
    const BANK_CONNECTIONS_COLLECTION_ID = COLLECTIONS.bankConnections;

    // Fetch user's bank accounts
    const accountsResponse = await databases.listDocuments(
      DATABASE_ID,
      BANK_ACCOUNTS_COLLECTION_ID,
      [Query.equal('userId', userId)]
    );

    // Fetch user's bank connections (we will map by accountId if available)
    let connectionsResponse: any = { documents: [] };
    try {
      connectionsResponse = await databases.listDocuments(
        DATABASE_ID,
        BANK_CONNECTIONS_COLLECTION_ID,
        [Query.equal('userId', userId)]
      );
    } catch (e) {
      // If collection doesn't exist yet, proceed with empty
      connectionsResponse = { documents: [] };
    }

    // Build latest connection per institutionId for this user
    const institutionIdToConnection: Record<string, any> = {};
    for (const conn of connectionsResponse.documents || []) {
      const inst = (conn as any).institutionId;
      if (!inst) continue;
      const prev = institutionIdToConnection[inst];
      const prevCreated = prev?.$createdAt ? Date.parse(prev.$createdAt) : 0;
      const currCreated = (conn as any).$createdAt ? Date.parse((conn as any).$createdAt) : 0;
      if (!prev || currCreated >= prevCreated) {
        institutionIdToConnection[inst] = conn;
      }
    }

    // Merge connection metadata into accounts
    const enriched = (accountsResponse.documents || []).map((acc: any) => {
      const accountId = acc?.accountId || acc?.$id;
      const conn = acc?.institutionId ? institutionIdToConnection[acc.institutionId] : undefined;

      // Access window computation fields
      const connCreatedAtIso: string | undefined = conn?.$createdAt || conn?.createdAt;
      const maxAccessValidforDays: number | undefined = typeof conn?.maxAccessValidforDays === 'number'
        ? conn.maxAccessValidforDays
        : (typeof conn?.max_access_valid_for_days === 'number' ? conn.max_access_valid_for_days : undefined);

      return {
        ...acc,
        logoUrl: conn?.logoUrl || conn?.logo || null,
        maxAccessValidforDays: maxAccessValidforDays ?? null,
        connectionCreatedAt: connCreatedAtIso || null,
        connectionStatus: conn?.status || null,
        connectionInstitutionName: conn?.institutionName || null,
      };
    });

    return NextResponse.json({
      ok: true,
      accounts: enriched,
    });

  } catch (err: any) {
    console.error('Error fetching accounts:', err);
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}