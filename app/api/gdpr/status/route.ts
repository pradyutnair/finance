import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/mongo/client";
import { Client, Databases } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

    const auth = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (token) {
      client.setJWT(token);
    } else {
      const apiKey = process.env.APPWRITE_API_KEY as string | undefined;
      if (apiKey) {
        (client as any).headers = { ...(client as any).headers, "X-Appwrite-Key": apiKey };
      }
    }

    const databases = new Databases(client);

    // Check consent status
    let consentGiven = false;
    try {
      const CONSENT_COLLECTION_ID = process.env.APPWRITE_CONSENT_COLLECTION_ID || 'user_consent_dev';
      const consentDoc = await databases.getDocument(
        DATABASE_ID,
        CONSENT_COLLECTION_ID,
        userId
      );
      consentGiven = consentDoc.preferences?.dataProcessing === true;
    } catch (error) {
      // No consent record exists
    }

    // Get user account creation date
    let accountCreated = '';
    try {
      const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
      const userDoc = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );
      accountCreated = userDoc.$createdAt;
    } catch (error) {
      // User record might not exist yet
    }

    // Get last export date (from deletion logs or export logs)
    let lastExport = null;
    try {
      const EXPORT_LOG_COLLECTION_ID = process.env.APPWRITE_EXPORT_LOG_COLLECTION_ID || 'export_logs_dev';
      const exportLogs = await databases.listDocuments(
        DATABASE_ID,
        EXPORT_LOG_COLLECTION_ID,
        [`userId = "${userId}"`],
        undefined,
        undefined,
        undefined,
        undefined,
        'createdAt'
      );
      
      if (exportLogs.documents.length > 0) {
        lastExport = exportLogs.documents[0].$createdAt;
      }
    } catch (error) {
      // No export logs exist
    }

    // Determine data types stored
    const dataTypes: string[] = [];

    // Check Appwrite collections
    try {
      const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
      await databases.getDocument(DATABASE_ID, USERS_PRIVATE_COLLECTION_ID, userId);
      dataTypes.push('userProfile');
    } catch (error) {
      // User profile doesn't exist
    }

    try {
      const BUDGETS_COLLECTION_ID = process.env.APPWRITE_BUDGETS_COLLECTION_ID || 'preferences_budgets_dev';
      const budgetsResponse = await databases.listDocuments(
        DATABASE_ID,
        BUDGETS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      if (budgetsResponse.documents.length > 0) {
        dataTypes.push('budgets');
      }
    } catch (error) {
      // No budgets
    }

    try {
      const GOALS_COLLECTION_ID = process.env.APPWRITE_GOALS_COLLECTION_ID || 'preferences_goals_dev';
      const goalsResponse = await databases.listDocuments(
        DATABASE_ID,
        GOALS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      if (goalsResponse.documents.length > 0) {
        dataTypes.push('goals');
      }
    } catch (error) {
      // No goals
    }

    // Check MongoDB collections (if using MongoDB backend)
    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();

      try {
        const connections = await db
          .collection('bank_connections_dev')
          .find({ userId })
          .limit(1)
          .toArray();
        if (connections.length > 0) {
          dataTypes.push('bankConnections');
        }
      } catch (error) {
        // No connections
      }

      try {
        const accounts = await db
          .collection('bank_accounts_dev')
          .find({ userId })
          .limit(1)
          .toArray();
        if (accounts.length > 0) {
          dataTypes.push('bankAccounts');
        }
      } catch (error) {
        // No accounts
      }

      try {
        const transactions = await db
          .collection('transactions_dev')
          .find({ userId })
          .limit(1)
          .toArray();
        if (transactions.length > 0) {
          dataTypes.push('transactions');
        }
      } catch (error) {
        // No transactions
      }

      try {
        const balances = await db
          .collection('balances_dev')
          .find({ userId })
          .limit(1)
          .toArray();
        if (balances.length > 0) {
          dataTypes.push('balances');
        }
      } catch (error) {
        // No balances
      }

      try {
        const requisitions = await db
          .collection('requisitions_dev')
          .find({ userId })
          .limit(1)
          .toArray();
        if (requisitions.length > 0) {
          dataTypes.push('requisitions');
        }
      } catch (error) {
        // No requisitions
      }
    }

    // Data retention periods
    const dataRetention = {
      userProfile: 'Until account deletion',
      bankConnections: 'Until revoked or account deletion',
      bankAccounts: 'Until account deletion',
      transactions: '7 years (legal requirement)',
      balances: '7 years (legal requirement)',
      budgets: 'Until account deletion',
      goals: 'Until account deletion',
      consentRecords: 'Until account deletion'
    };

    return NextResponse.json({
      ok: true,
      consentGiven,
      dataTypes,
      lastExport,
      accountCreated,
      dataRetention,
      gdprCompliant: true,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching GDPR status:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch GDPR status' },
      { status: 500 }
    );
  }
}
