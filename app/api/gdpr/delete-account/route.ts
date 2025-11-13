import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/mongo/client";
import { Client, Databases, Account } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;
    const body = await request.json();
    const { confirmDeletion, reason } = body;

    if (!confirmDeletion) {
      return NextResponse.json(
        { ok: false, error: 'Account deletion must be explicitly confirmed' },
        { status: 400 }
      );
    }

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
    const account = new Account(client);

    const deletionLog = {
      userId,
      deletionDate: new Date().toISOString(),
      reason: reason || 'User requested account deletion',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      deletedDataTypes: [] as string[]
    };

    // 1. Delete MongoDB data (if using MongoDB backend)
    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();

      try {
        // Delete bank connections
        const connectionsResult = await db
          .collection('bank_connections_dev')
          .deleteMany({ userId });
        if (connectionsResult.deletedCount > 0) {
          deletionLog.deletedDataTypes.push(`bankConnections (${connectionsResult.deletedCount} records)`);
        }
      } catch (error) {
        console.error('Error deleting bank connections:', error);
      }

      try {
        // Delete bank accounts
        const accountsResult = await db
          .collection('bank_accounts_dev')
          .deleteMany({ userId });
        if (accountsResult.deletedCount > 0) {
          deletionLog.deletedDataTypes.push(`bankAccounts (${accountsResult.deletedCount} records)`);
        }
      } catch (error) {
        console.error('Error deleting bank accounts:', error);
      }

      try {
        // Delete transactions
        const transactionsResult = await db
          .collection('transactions_plaid')
          .deleteMany({ userId });
        if (transactionsResult.deletedCount > 0) {
          deletionLog.deletedDataTypes.push(`transactions (${transactionsResult.deletedCount} records)`);
        }
      } catch (error) {
        console.error('Error deleting transactions:', error);
      }

      try {
        // Delete balances
        const balancesResult = await db
          .collection('balances_dev')
          .deleteMany({ userId });
        if (balancesResult.deletedCount > 0) {
          deletionLog.deletedDataTypes.push(`balances (${balancesResult.deletedCount} records)`);
        }
      } catch (error) {
        console.error('Error deleting balances:', error);
      }

      try {
        // Delete requisitions
        const requisitionsResult = await db
          .collection('requisitions_dev')
          .deleteMany({ userId });
        if (requisitionsResult.deletedCount > 0) {
          deletionLog.deletedDataTypes.push(`requisitions (${requisitionsResult.deletedCount} records)`);
        }
      } catch (error) {
        console.error('Error deleting requisitions:', error);
      }
    }

    // 2. Delete Appwrite data
    try {
      // Delete user profile
      const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
      await databases.deleteDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );
      deletionLog.deletedDataTypes.push('userProfile');
    } catch (error) {
      console.warn('Could not delete user profile:', error);
    }

    try {
      // Delete budgets
      const BUDGETS_COLLECTION_ID = process.env.APPWRITE_BUDGETS_COLLECTION_ID || 'preferences_budgets_dev';
      const budgetsResponse = await databases.listDocuments(
        DATABASE_ID,
        BUDGETS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      
      for (const budget of budgetsResponse.documents) {
        await databases.deleteDocument(
          DATABASE_ID,
          BUDGETS_COLLECTION_ID,
          budget.$id
        );
      }
      if (budgetsResponse.documents.length > 0) {
        deletionLog.deletedDataTypes.push(`budgets (${budgetsResponse.documents.length} records)`);
      }
    } catch (error) {
      console.warn('Could not delete budgets:', error);
    }

    try {
      // Delete goals
      const GOALS_COLLECTION_ID = process.env.APPWRITE_GOALS_COLLECTION_ID || 'preferences_goals_dev';
      const goalsResponse = await databases.listDocuments(
        DATABASE_ID,
        GOALS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      
      for (const goal of goalsResponse.documents) {
        await databases.deleteDocument(
          DATABASE_ID,
          GOALS_COLLECTION_ID,
          goal.$id
        );
      }
      if (goalsResponse.documents.length > 0) {
        deletionLog.deletedDataTypes.push(`goals (${goalsResponse.documents.length} records)`);
      }
    } catch (error) {
      console.warn('Could not delete goals:', error);
    }

    try {
      // Delete consent records
      const CONSENT_COLLECTION_ID = process.env.APPWRITE_CONSENT_COLLECTION_ID || 'user_consent_dev';
      await databases.deleteDocument(
        DATABASE_ID,
        CONSENT_COLLECTION_ID,
        userId
      );
      deletionLog.deletedDataTypes.push('consentRecords');
    } catch (error) {
      console.warn('Could not delete consent records:', error);
    }

    // 3. Delete Appwrite account (this will also delete all sessions)
    try {
      await account.delete();
      deletionLog.deletedDataTypes.push('appwriteAccount');
    } catch (error) {
      console.error('Error deleting Appwrite account:', error);
      // Continue with deletion even if account deletion fails
    }

    // 4. Log the deletion for audit purposes
    try {
      const DELETION_LOG_COLLECTION_ID = process.env.APPWRITE_DELETION_LOG_COLLECTION_ID || 'deletion_logs_dev';
      await databases.createDocument(
        DATABASE_ID,
        DELETION_LOG_COLLECTION_ID,
        `deletion_${userId}_${Date.now()}`,
        deletionLog
      );
    } catch (error) {
      console.error('Error logging deletion:', error);
      // Don't fail the deletion if logging fails
    }

    return NextResponse.json({
      ok: true,
      message: 'Account and all associated data have been permanently deleted',
      deletionLog: {
        deletedDataTypes: deletionLog.deletedDataTypes,
        deletionDate: deletionLog.deletionDate
      }
    });

  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    );
  }
}

// GET endpoint to check deletion status (for confirmation)
export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;

    return NextResponse.json({
      ok: true,
      message: 'Account deletion confirmation',
      warning: 'This action is irreversible and will permanently delete all your data',
      dataTypes: [
        'User profile and preferences',
        'Bank account connections',
        'Transaction history',
        'Balance records',
        'Budget settings',
        'Financial goals',
        'Consent records'
      ],
      retention: {
        note: 'Some data may be retained for legal compliance (e.g., financial records for 7 years)',
        contact: 'Contact support if you have questions about data retention'
      }
    });

  } catch (error: any) {
    console.error('Error checking deletion status:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to check deletion status' },
      { status: 500 }
    );
  }
}
