export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getRequisition, listRequisitions, getAccounts, getBalances, getTransactions, HttpError } from "@/lib/gocardless";
import { Client, Databases, ID, Query } from "appwrite";
import { createAppwriteClient } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requisitionId } = await params;

    // Identify the user: prefer authenticated session, else parse from reference
    let authedUserId: string | null = null;
    try {
      const authedUser: any = await requireAuthUser(request);
      authedUserId = (authedUser?.$id || authedUser?.id || null) as string | null;
    } catch {
      // Not authenticated via JWT/cookie; will fallback to reference parsing
    }

    // Get requisition status from GoCardless, with fallback via list if needed
    let requisition: any = null;
    try {
      requisition = await getRequisition(requisitionId);
    } catch (err: any) {
      if (err instanceof HttpError && (err.status === 404 || err.status === 400)) {
        try {
          const all = await listRequisitions();
          const found = all?.results?.find((req: any) => req.id === requisitionId);
          if (found) {
            requisition = found;
          }
        } catch (listErr) {
          // ignore, will handle below
        }
      } else {
        throw err;
      }
    }

    if (!requisition) {
      return NextResponse.json({ ok: false, error: "Requisition not found" }, { status: 404 });
    }

    // Determine userId: use authed user first, else try to parse from reference
    let userId: string | undefined = authedUserId || undefined;
    if (!userId) {
      const reference: string | undefined = requisition.reference;
      if (reference && typeof reference === 'string') {
        // Support both user_ and sandbox_ prefixes
        const match = reference.match(/^(?:user|sandbox)_([^_]+)_/);
        if (match && match[1]) {
          userId = match[1];
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unable to determine user from session or reference" }, { status: 400 });
    }

    // If requisition is linked, process the accounts
    if ((requisition.status === 'LINKED' || requisition.status === 'LN') && requisition.accounts && requisition.accounts.length > 0) {
      // Resolve DB and collection IDs from env with sensible defaults
      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
      const REQUISITIONS_COLLECTION_ID = process.env.APPWRITE_REQUISITIONS_COLLECTION_ID || 'requisitions_dev';
      const BANK_CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_BANK_CONNECTIONS_COLLECTION_ID || 'bank_connections_dev';
      const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';
      const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';
      const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
      // Create server-side client with API key
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);
      
      // Set API key for server-side operations manually
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
      const databases = new Databases(client);

      try {
        // Store requisition in database first
        try {
          await databases.createDocument(
            DATABASE_ID,
            REQUISITIONS_COLLECTION_ID,
            requisition.id,
            {
              userId: userId,
              requisitionId: requisition.id,
              institutionId: requisition.institution_id,
              institutionName: requisition.institution_name || 'Unknown Bank',
              status: requisition.status,
              reference: requisition.reference,
              // Some schemas require redirectUri; prefer value from requisition, else env
              redirectUri: (requisition.redirect as string | undefined) || (process.env.GC_REDIRECT_URI as string | undefined) || undefined,
            }
          );
        } catch (error) {
          console.error('Error storing requisition:', error);
        }

        // Create bank connection record first to get connectionId
        let connectionDocId = '';
        try {
          const connectionDoc = await databases.createDocument(
            DATABASE_ID,
            BANK_CONNECTIONS_COLLECTION_ID,
            ID.unique(),
            {
              userId: userId,
              institutionId: requisition.institution_id,
              institutionName: requisition.institution_name || 'Unknown Bank',
              status: 'active',
              requisitionId: requisition.id,
            }
          );
          connectionDocId = connectionDoc.$id;
          console.log('✅ Created bank connection:', connectionDocId);
        } catch (error) {
          console.error('Error storing bank connection:', error);
          throw error; // Stop processing if connection creation fails
        }

        // Process each account
        for (const accountId of requisition.accounts) {
          try {
            // Get account details
            const accountDetails = await getAccounts(accountId);
            
            // Store bank account in database
            try {
              const accountDoc = await databases.createDocument(
                DATABASE_ID,
                BANK_ACCOUNTS_COLLECTION_ID,
                accountId,
                {
                  userId: userId,
                  accountId: accountId,
                  institutionId: requisition.institution_id,
                  institutionName: requisition.institution_name || 'Unknown Bank',
                  iban: accountDetails.iban || null,
                  accountName: accountDetails.name || null,
                  currency: accountDetails.currency || 'EUR',
                  status: 'active',
                  raw: JSON.stringify(accountDetails),
                }
              );

              // Get and store balances
              try {
                const balancesResponse = await getBalances(accountId);
                const balances = balancesResponse?.balances || [];
                if (balances && balances.length > 0) {
                  for (const balance of balances) {
                    try {
                      // Check if balance already exists to avoid duplicates
                      const balanceType = balance.balanceType || 'closingBooked';
                      const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
                      
                      try {
                        const existingBalances = await databases.listDocuments(
                          DATABASE_ID,
                          BALANCES_COLLECTION_ID,
                          [
                            Query.equal('accountId', accountId),
                            Query.equal('balanceType', balanceType),
                            Query.equal('referenceDate', referenceDate)
                          ]
                        );
                        
                        if (existingBalances.documents.length > 0) {
                          console.log(`Balance for ${accountId} ${balanceType} ${referenceDate} already exists, skipping`);
                          continue;
                        }
                      } catch (queryError) {
                        console.log('Error checking existing balance, proceeding with creation');
                      }
                      
                      // Use ID.unique() to generate a unique document ID
                      await databases.createDocument(
                        DATABASE_ID,
                        BALANCES_COLLECTION_ID,
                        ID.unique(),
                        {
                          userId: userId,
                          accountId: accountId,
                          balanceAmount: balance.balanceAmount?.amount || '0',
                          currency: balance.balanceAmount?.currency || 'EUR',
                          balanceType: balanceType,
                          referenceDate: referenceDate,
                        }
                      );
                    } catch (error: any) {
                      if (error.message?.includes('already exists')) {
                        console.log('Balance already exists, skipping');
                      } else {
                        console.error('Error storing balance:', error);
                      }
                    }
                  }
                }
              } catch (balanceError) {
                console.error(`Error fetching balances for account ${accountId}:`, balanceError);
              }

              // Get and store recent transactions
              try {
                const transactionsResponse = await getTransactions(accountId);
                const transactions = transactionsResponse?.transactions?.booked || [];
                if (transactions && transactions.length > 0) {
                  for (const transaction of transactions.slice(0, 100)) {
                    try {
                      // Use the actual transaction ID from GoCardless as a field, but generate unique doc ID
                      const goCardlessTransactionId = transaction.transactionId || transaction.internalTransactionId;
                      
                      // Check if transaction already exists to avoid duplicates
                      if (goCardlessTransactionId) {
                        try {
                          const existingTransactions = await databases.listDocuments(
                            DATABASE_ID,
                            TRANSACTIONS_COLLECTION_ID,
                            [
                              Query.equal('transactionId', goCardlessTransactionId),
                              Query.equal('accountId', accountId)
                            ]
                          );
                          
                          if (existingTransactions.documents.length > 0) {
                            console.log(`Transaction ${goCardlessTransactionId} already exists, skipping`);
                            continue;
                          }
                        } catch (queryError) {
                          console.log('Error checking existing transaction, proceeding with creation');
                        }
                      }
                      
                      // Use ID.unique() to generate a unique document ID
                      await databases.createDocument(
                        DATABASE_ID,
                        TRANSACTIONS_COLLECTION_ID,
                        ID.unique(),
                        {
                          userId: userId,
                          accountId: accountId,
                          transactionId: goCardlessTransactionId || `generated_${accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          amount: transaction.transactionAmount?.amount || '0',
                          currency: transaction.transactionAmount?.currency || 'EUR',
                          bookingDate: transaction.bookingDate || null,
                          bookingDateTime: transaction.bookingDateTime || null,
                          valueDate: transaction.valueDate || null,
                          description: transaction.remittanceInformationUnstructured || transaction.additionalInformation || '',
                          counterparty: transaction.creditorName || transaction.debtorName || '',
                          raw: JSON.stringify(transaction),
                        }
                      );
                    } catch (error: any) {
                      // Log error but continue processing other transactions
                      if (error.message?.includes('already exists')) {
                        console.log('Transaction already exists, skipping');
                      } else {
                        console.error('Error storing transaction:', error);
                      }
                    }
                  }
                }
              } catch (transactionError) {
                console.error(`Error fetching transactions for account ${accountId}:`, transactionError);
              }
            } catch (error) {
              console.error('Error storing bank account:', error);
            }
          } catch (accountError) {
            console.error(`Error processing account ${accountId}:`, accountError);
          }
        }

      } catch (dbError) {
        console.error("Error storing data in database:", dbError);
        // Still return success if GoCardless connection worked
      }
    }

    return NextResponse.json({
      ok: true,
      status: requisition.status,
      institutionName: requisition.institution_name,
      accountCount: requisition.accounts?.length || 0,
      requisition
    });

  } catch (err: any) {
    console.error("Error processing requisition callback:", err);
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    const status = err?.status || 500;
    const message = err?.message || "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
