export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getRequisition, listRequisitions, getAccounts, getBalances, getTransactions, getInstitution, HttpError } from "@/lib/gocardless";
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
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : String(authError);
      console.log('🔍 Authentication failed in callback, will use reference parsing:', message);
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
        console.log('🔍 Parsing user ID from reference:', reference);
        
        // Support both user_ and sandbox_ prefixes, and dev-user format
        let match = reference.match(/^(?:user|sandbox)_([^_]+)_/);
        if (!match) {
          // Try dev-user format: dev-user-timestamp
          match = reference.match(/^dev-user-(\d+)/);
        }
        
        if (match && match[1]) {
          userId = match[1];
          console.log('✅ Extracted user ID from reference:', userId);
        } else {
          console.log('❌ Could not parse user ID from reference format');
        }
      }
    }

    if (!userId) {
      console.error('❌ Unable to determine user ID from session or reference');
      console.error('📝 Requisition reference:', requisition?.reference);
      console.error('🔑 Authenticated user ID:', authedUserId);
      return NextResponse.json({ ok: false, error: "Unable to determine user from session or reference" }, { status: 400 });
    }

    console.log('✅ Processing requisition for user:', userId);

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
        // Fetch institution metadata (logo, transaction_total_days, max_access_valid_for_days)
        let logoUrl: string | null = null;
        let transactionTotalDays: number | null = null;
        let maxAccessValidForDays: number | null = null;
        try {
          const institution = await getInstitution(requisition.institution_id);
          logoUrl = (institution && (institution.logo as string)) || null;
          const ttlRaw = institution && (institution.transaction_total_days as any);
          const ttlNum = ttlRaw !== undefined && ttlRaw !== null ? Number(ttlRaw) : null;
          transactionTotalDays = Number.isFinite(ttlNum as number) ? (ttlNum as number) : null;
          const maxAccessRaw = institution && (institution.max_access_valid_for_days as any);
          const maxAccessNum = maxAccessRaw !== undefined && maxAccessRaw !== null ? Number(maxAccessRaw) : null;
          maxAccessValidForDays = Number.isFinite(maxAccessNum as number) ? (maxAccessNum as number) : null;
        } catch {
          // proceed without institution metadata
        }

        // Store requisition in database (after metadata ready)
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
              // Institution metadata on connections only - match your Appwrite fields exactly
              logoUrl: logoUrl || undefined,
              transactionTotalDays: (transactionTotalDays ?? undefined) as any,
              maxAccessValidforDays: (maxAccessValidForDays ?? (typeof (requisition as any)?.max_access_valid_for_days !== 'undefined'
                ? Number((requisition as any).max_access_valid_for_days)
                : undefined)) as any,
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
            
            // Store bank account in database (skip if $id exists)
            try {
              let exists = false;
              try {
                await databases.getDocument(
                  DATABASE_ID,
                  BANK_ACCOUNTS_COLLECTION_ID,
                  accountId
                );
                exists = true;
                console.log(`Bank account ${accountId} already exists, skipping create.`);
              } catch (checkErr: any) {
                const code = (checkErr && (checkErr.code || checkErr.responseCode)) as number | undefined;
                if (code && code !== 404) {
                  console.warn('Error checking existing bank account, will attempt create:', checkErr);
                }
              }

              if (!exists) {
                await databases.createDocument(
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
              }

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
                      // Use the provider transaction id when available, else fallback to internal id
                      const goCardlessTransactionId: string | undefined =
                        transaction.transactionId || transaction.internalTransactionId || undefined;

                      // Create a deterministic document id per (accountId, transactionId)
                      const baseId = goCardlessTransactionId
                        ? `${accountId}_${goCardlessTransactionId}`
                        : `${accountId}_${
                            (transaction.bookingDate || '') + '_' +
                            (transaction.transactionAmount?.amount || '') + '_' +
                            (transaction.remittanceInformationUnstructured || transaction.additionalInformation || '')
                          }`;
                      const docId = baseId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);

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
                      // Ignore duplicates silently; continue processing
                      if (error?.message?.includes('already exists') || error?.code === 409) {
                        // duplicate id -> already stored
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
              const code = (error && (error as any).code) as number | undefined;
              if (code === 409) {
                console.log(`Bank account ${accountId} already exists (409), skipping.`);
              } else {
                console.error('Error storing bank account:', error);
              }
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
