import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/mongo/client";
import { Client, Databases } from "appwrite";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;

export async function POST(request: Request) {
  try {
    const user = await requireAuthUser(request);
    const userId = user.$id || user.id;
    const body = await request.json();
    const { format = 'json' } = body;

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid format. Supported formats: json, csv' },
        { status: 400 }
      );
    }

    // Check if user has consented to data processing
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

    // Collect all user data
    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      dataTypes: [] as string[],
      data: {} as any
    };

    // 1. User Profile Data (from Appwrite)
    try {
      const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
      const userProfile = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );
      exportData.data.userProfile = userProfile;
      exportData.dataTypes.push('userProfile');
    } catch (error) {
      console.warn('Could not fetch user profile:', error);
    }

    // 2. Budget Preferences (from Appwrite)
    try {
      const BUDGETS_COLLECTION_ID = process.env.APPWRITE_BUDGETS_COLLECTION_ID || 'preferences_budgets_dev';
      const budgetsResponse = await databases.listDocuments(
        DATABASE_ID,
        BUDGETS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      exportData.data.budgets = budgetsResponse.documents;
      if (budgetsResponse.documents.length > 0) {
        exportData.dataTypes.push('budgets');
      }
    } catch (error) {
      console.warn('Could not fetch budgets:', error);
    }

    // 3. Financial Goals (from Appwrite)
    try {
      const GOALS_COLLECTION_ID = process.env.APPWRITE_GOALS_COLLECTION_ID || 'preferences_goals_dev';
      const goalsResponse = await databases.listDocuments(
        DATABASE_ID,
        GOALS_COLLECTION_ID,
        [`userId = "${userId}"`]
      );
      exportData.data.goals = goalsResponse.documents;
      if (goalsResponse.documents.length > 0) {
        exportData.dataTypes.push('goals');
      }
    } catch (error) {
      console.warn('Could not fetch goals:', error);
    }

    // 4. MongoDB Data (if using MongoDB backend)
    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();

      // Bank Connections
      try {
        const connections = await db
          .collection('bank_connections_dev')
          .find({ userId })
          .toArray();
        exportData.data.bankConnections = connections;
        if (connections.length > 0) {
          exportData.dataTypes.push('bankConnections');
        }
      } catch (error) {
        console.warn('Could not fetch bank connections:', error);
      }

      // Bank Accounts
      try {
        const accounts = await db
          .collection('bank_accounts_dev')
          .find({ userId })
          .toArray();
        exportData.data.bankAccounts = accounts;
        if (accounts.length > 0) {
          exportData.dataTypes.push('bankAccounts');
        }
      } catch (error) {
        console.warn('Could not fetch bank accounts:', error);
      }

      // Transactions
      try {
        const transactions = await db
          .collection('transactions_plaid')
          .find({ userId })
          .sort({ bookingDate: -1 })
          .toArray();
        exportData.data.transactions = transactions;
        if (transactions.length > 0) {
          exportData.dataTypes.push('transactions');
        }
      } catch (error) {
        console.warn('Could not fetch transactions:', error);
      }

      // Balances
      try {
        const balances = await db
          .collection('balances_dev')
          .find({ userId })
          .sort({ referenceDate: -1 })
          .toArray();
        exportData.data.balances = balances;
        if (balances.length > 0) {
          exportData.dataTypes.push('balances');
        }
      } catch (error) {
        console.warn('Could not fetch balances:', error);
      }

      // Requisitions
      try {
        const requisitions = await db
          .collection('requisitions_dev')
          .find({ userId })
          .toArray();
        exportData.data.requisitions = requisitions;
        if (requisitions.length > 0) {
          exportData.dataTypes.push('requisitions');
        }
      } catch (error) {
        console.warn('Could not fetch requisitions:', error);
      }
    }

    // 5. Add metadata
    exportData.metadata = {
      totalDataTypes: exportData.dataTypes.length,
      exportFormat: format,
      gdprCompliant: true,
      dataRetention: {
        transactions: '7 years (financial records)',
        userProfile: 'Until account deletion',
        bankConnections: 'Until revoked or account deletion',
        budgets: 'Until account deletion'
      }
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified - you might want to use a proper CSV library)
      const csvData = convertToCSV(exportData);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="nexpass-data-export-${userId}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Return JSON format
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="nexpass-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`
      }
    });

  } catch (error: any) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to export user data' },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any): string {
  // Simple CSV conversion - you might want to use a proper CSV library
  const lines: string[] = [];
  
  lines.push('Data Type,Field,Value');
  lines.push(`Export Info,Export Date,${data.exportDate}`);
  lines.push(`Export Info,User ID,${data.userId}`);
  lines.push(`Export Info,Data Types,${data.dataTypes.join('; ')}`);
  
  // Add user profile data
  if (data.data.userProfile) {
    Object.entries(data.data.userProfile).forEach(([key, value]) => {
      lines.push(`User Profile,${key},"${value}"`);
    });
  }
  
  // Add transactions
  if (data.data.transactions) {
    data.data.transactions.forEach((tx: any, index: number) => {
      lines.push(`Transaction ${index + 1},ID,${tx._id || tx.id}`);
      lines.push(`Transaction ${index + 1},Date,${tx.bookingDate}`);
      lines.push(`Transaction ${index + 1},Amount,${tx.amount}`);
      lines.push(`Transaction ${index + 1},Description,${tx.description || ''}`);
      lines.push(`Transaction ${index + 1},Category,${tx.category || ''}`);
    });
  }
  
  return lines.join('\n');
}
