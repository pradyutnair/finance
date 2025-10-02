export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { Client, Databases, Query } from "appwrite";
import { isEncryptionEnabled } from "@/lib/server/encryption-service";
import { readEncrypted, EncryptionRouteConfig } from "@/lib/http/withEncryption";

export async function GET(request: Request) {
  try {
    // Require authenticated user
    const user: any = await requireAuthUser(request);
    const userId = user.$id || user.id;

    // Create Appwrite client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
    
    client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
    const databases = new Databases(client);

    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
    const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';
    const BANK_CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_BANK_CONNECTIONS_COLLECTION_ID || 'bank_connections_dev';

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

    // Check if encryption is enabled
    const useEncryption = isEncryptionEnabled();

    // Merge connection metadata and decrypt sensitive account data
    const enrichedPromises = (accountsResponse.documents || []).map(async (acc: any) => {
      const accountId = acc?.accountId || acc?.$id;
      const conn = acc?.institutionId ? institutionIdToConnection[acc.institutionId] : undefined;

      // Access window computation fields
      const connCreatedAtIso: string | undefined = conn?.$createdAt || conn?.createdAt;
      const maxAccessValidforDays: number | undefined = typeof conn?.maxAccessValidforDays === 'number'
        ? conn.maxAccessValidforDays
        : (typeof conn?.max_access_valid_for_days === 'number' ? conn.max_access_valid_for_days : undefined);

      let accountData = {
        ...acc,
        logoUrl: conn?.logoUrl || conn?.logo || null,
        maxAccessValidforDays: maxAccessValidforDays ?? null,
        connectionCreatedAt: connCreatedAtIso || null,
        connectionStatus: conn?.status || null,
        connectionInstitutionName: conn?.institutionName || null,
      };

      // If encryption is enabled, decrypt sensitive account data
      if (useEncryption && accountId) {
        try {
          const config: EncryptionRouteConfig = {
            databases,
            databaseId: DATABASE_ID,
            encryptedCollectionId: process.env.APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID || 'bank_accounts_enc',
            userId,
          };

          const decrypted = await readEncrypted(accountId, config);
          // Merge decrypted sensitive data (iban, accountName, etc.)
          accountData = {
            ...accountData,
            ...decrypted,
          };
        } catch (err) {
          console.warn(`Failed to decrypt account ${accountId}:`, err);
          // Continue with public data only
        }
      }

      return accountData;
    });

    const enriched = await Promise.all(enrichedPromises);

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