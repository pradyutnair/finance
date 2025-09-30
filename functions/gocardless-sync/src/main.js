/**
 * Appwrite Function for ongoing GoCardless transaction sync
 * Runs 4 times daily to fetch latest transactions and update database
 */

// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // Use context.log() for logging that will be visible in Appwrite logs
  log('🚀 Starting GoCardless transaction sync...');

  // Import modules using dynamic imports for better compatibility
  let Client, Databases, Query, ID;
  try {
    const appwriteModule = await import('appwrite');
    ({ Client, Databases, Query, ID } = appwriteModule);
    log('✅ Appwrite SDK imported successfully');
  } catch (err) {
    log(`❌ Failed to import Appwrite SDK: ${err.message}`);
    throw new Error('Failed to import Appwrite SDK');
  }

  // Import crypto for hashing
  let createHash;
  try {
    const cryptoModule = await import('crypto');
    ({ createHash } = cryptoModule);
    log('✅ Crypto module imported successfully');
  } catch (err) {
    log(`❌ Failed to import crypto module: ${err.message}`);
    throw new Error('Failed to import crypto module');
  }

  // Import GoCardless client
  let getTransactions, getAccounts, getBalances, getInstitution, HttpError;
  try {
    const gocardlessModule = await import('../lib/gocardless.js');
    ({ getTransactions, getAccounts, getBalances, getInstitution, HttpError } = gocardlessModule);
    log('✅ GoCardless client imported successfully');
  } catch (err) {
    log(`❌ Failed to import GoCardless client: ${err.message}`);
    throw new Error('Failed to import GoCardless client');
  }

  // Validate required environment variables (Appwrite Functions runtime)
  const requiredEnvVars = [
    'APPWRITE_FUNCTION_API_ENDPOINT',
    'APPWRITE_FUNCTION_PROJECT_ID',
    'APPWRITE_API_KEY',
    'APPWRITE_DATABASE_ID',
    'GOCARDLESS_SECRET_ID',
    'GOCARDLESS_SECRET_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  log(`🔧 Validating environment variables...`);
  log(`✅ APPWRITE_FUNCTION_API_ENDPOINT: ${process.env.APPWRITE_FUNCTION_API_ENDPOINT?.substring(0, 50)}...`);
  log(`✅ APPWRITE_FUNCTION_PROJECT_ID: ${process.env.APPWRITE_FUNCTION_PROJECT_ID}`);
  log(`✅ APPWRITE_DATABASE_ID: ${process.env.APPWRITE_DATABASE_ID}`);

  // Initialize Appwrite client (using Appwrite Functions environment variables)
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);

  // Configuration
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
  const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
  const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';
  const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

  // Make constants available to helper functions
  global.DATABASE_ID = DATABASE_ID;
  global.TRANSACTIONS_COLLECTION_ID = TRANSACTIONS_COLLECTION_ID;
  global.BANK_ACCOUNTS_COLLECTION_ID = BANK_ACCOUNTS_COLLECTION_ID;
  global.BALANCES_COLLECTION_ID = BALANCES_COLLECTION_ID;

  log(`🔧 Appwrite client initialized successfully`);
  log(`📊 Database ID: ${DATABASE_ID}`);
  log(`🏦 Bank accounts collection: ${BANK_ACCOUNTS_COLLECTION_ID}`);
  log(`💰 Transactions collection: ${TRANSACTIONS_COLLECTION_ID}`);
  log(`⚖️ Balances collection: ${BALANCES_COLLECTION_ID}`);

  // Rate limiting configuration
  const API_CALL_DELAY_MS = 1000; // 1 second between API calls
  const MAX_ACCOUNTS_PER_BATCH = 5; // Process accounts in small batches
  const MAX_USERS_PER_EXECUTION = 10; // Limit users per execution to avoid timeouts

  // Utility function for rate limiting
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Categorization functions (simplified version of existing categorize.ts logic)
  function suggestCategory(description, counterparty, amount) {
    const text = `${counterparty || ''} ${description || ''}`.toLowerCase().trim();
    const value = parseFloat(amount || '0');

    if (text.includes('salary') || text.includes('payroll') || (value > 0 && text.includes('income'))) {
      return 'Income';
    }
    if (text.includes('restaurant') || text.includes('cafe') || text.includes('mcdonald') || text.includes('starbucks')) {
      return 'Restaurant';
    }
    if (text.includes('uber') || text.includes('taxi') || text.includes('fuel') || text.includes('gas')) {
      return 'Transport';
    }
    if (text.includes('amazon') || text.includes('store') || text.includes('shopping')) {
      return 'Shopping';
    }
    if (text.includes('netflix') || text.includes('spotify') || text.includes('entertainment')) {
      return 'Entertainment';
    }
    if (text.includes('electric') || text.includes('gas') || text.includes('utility') || text.includes('rent')) {
      return 'Utilities';
    }
    if (text.includes('grocery') || text.includes('supermarket') || text.includes('aldi') || text.includes('tesco')) {
      return 'Groceries';
    }

    return 'Uncategorized';
  }

  async function findExistingCategory(databases, databaseId, collectionId, userId, description) {
    try {
      const response = await databases.listDocuments(
        global.DATABASE_ID,
        global.TRANSACTIONS_COLLECTION_ID,
        [
          Query.equal('userId', userId),
          Query.search('description', description.slice(0, 50)),
          Query.limit(5)
        ]
      );

      const categoryCount = {};
      for (const doc of response.documents) {
        if (doc.category && doc.category !== 'Uncategorized') {
          categoryCount[doc.category] = (categoryCount[doc.category] || 0) + 1;
        }
      }

      const topCategory = Object.entries(categoryCount).sort(([,a], [,b]) => b - a)[0];
      return topCategory && topCategory[1] >= 2 ? topCategory[0] : null;

    } catch (error) {
      log(`Error finding existing category: ${error.message}`);
      return null;
    }
  }

  // Main sync execution logic
  try {
    const startTime = new Date();
    // Get all users with active bank accounts
    const accountsResponse = await databases.listDocuments(
      DATABASE_ID,
      BANK_ACCOUNTS_COLLECTION_ID,
      [
        Query.equal('status', 'active'),
        Query.limit(100) // Process in batches if needed
      ]
    );

    // Get unique user IDs
    const userIds = [...new Set(accountsResponse.documents.map(account => account.userId))];
    log(`🔍 Found ${userIds.length} users with active bank accounts`);

    if (userIds.length === 0) {
      log('⚠️ No users with active bank accounts found');
      return res.json({ success: true, message: 'No users to sync', usersProcessed: 0 });
    }

    // Process users in batches to avoid overwhelming the system
    const usersToProcess = userIds.slice(0, MAX_USERS_PER_EXECUTION);
    log(`Processing ${usersToProcess.length} users (limited to ${MAX_USERS_PER_EXECUTION} per execution)`);

    let totalUsersProcessed = 0;
    let totalTransactionsSynced = 0;

    // Process each user with individual error handling and rate limiting
    for (let i = 0; i < usersToProcess.length; i++) {
      const userId = usersToProcess[i];

      try {
        log(`👤 Processing user ${userId} (${i + 1}/${usersToProcess.length})`);

        // Get all bank accounts for this user
        const userAccountsResponse = await databases.listDocuments(
          DATABASE_ID,
          BANK_ACCOUNTS_COLLECTION_ID,
          [
            Query.equal('userId', userId),
            Query.equal('status', 'active')
          ]
        );

        const accounts = userAccountsResponse.documents;
        log(`🏦 Found ${accounts.length} active accounts for user ${userId}`);

        // Process accounts in batches with rate limiting
        for (let j = 0; j < accounts.length; j += MAX_ACCOUNTS_PER_BATCH) {
          const accountBatch = accounts.slice(j, j + MAX_ACCOUNTS_PER_BATCH);
          log(`Processing account batch ${Math.floor(j / MAX_ACCOUNTS_PER_BATCH) + 1}/${Math.ceil(accounts.length / MAX_ACCOUNTS_PER_BATCH)} (${accountBatch.length} accounts)`);

          for (let k = 0; k < accountBatch.length; k++) {
            const account = accountBatch[k];
            const accountId = account.accountId;

            try {
              log(`💳 Processing account: ${accountId} (${k + 1}/${accountBatch.length})`);

              // Get transactions from GoCardless
              log(`📡 Calling GoCardless API for transactions on account ${accountId}`);
              const transactionsResponse = await getTransactions(accountId);
              const transactions = transactionsResponse?.transactions?.booked || [];

              log(`📊 Retrieved ${transactions.length} transactions for account ${accountId}`);

              // Process and store transactions
              for (const transaction of transactions.slice(0, 100)) {
                try {
                  log(`🔄 Processing transaction: ${transaction.transactionId || 'unknown'} for account ${accountId}`);
                  await processTransaction(databases, account, transaction, userId, log);
                  totalTransactionsSynced++;
                  log(`✅ Successfully processed transaction for account ${accountId}`);
                } catch (error) {
                  if (error.message?.includes('already exists') || error.code === 409) {
                    log(`⏭️ Transaction already exists for ${accountId}, skipping`);
                  } else {
                    log(`❌ Error processing transaction for account ${accountId}: ${error.message}`);
                  }
                }
              }

              // Update balances if needed
              try {
                log(`⚖️ Updating balances for account ${accountId}`);
                await updateAccountBalances(databases, accountId, userId, log);
                log(`✅ Balances updated for account ${accountId}`);
              } catch (error) {
                log(`❌ Error updating balances for account ${accountId}: ${error.message}`);
              }

            } catch (error) {
              log(`Error processing account ${accountId}: ${error.message}`);
            }

            // Add delay between accounts within a batch
            if (k < accountBatch.length - 1) {
              log(`⏳ Waiting ${API_CALL_DELAY_MS}ms before next account in batch...`);
              await sleep(API_CALL_DELAY_MS / 2);
            }
          }

          // Add longer delay between batches
          if (j + MAX_ACCOUNTS_PER_BATCH < accounts.length) {
            log(`⏳ Waiting ${API_CALL_DELAY_MS * 2}ms before next batch...`);
            await sleep(API_CALL_DELAY_MS * 2);
          }
        }

        totalUsersProcessed++;
        log(`✅ Successfully processed user ${userId}`);

        // Add delay between users to respect rate limits
        if (i < usersToProcess.length - 1) {
          log(`⏳ Waiting ${API_CALL_DELAY_MS}ms before next user...`);
          await sleep(API_CALL_DELAY_MS);
        }

      } catch (error) {
        log(`❌ Failed to sync user ${userId}: ${error.message}`);
        // Continue with other users even if one fails
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    log(`🎉 Sync completed in ${duration}ms`);
    log(`📈 Final results: Processed ${totalUsersProcessed} users, synced ${totalTransactionsSynced} transactions`);
    log(`📊 Total users found: ${userIds.length}, Success rate: ${((totalUsersProcessed / usersToProcess.length) * 100).toFixed(1)}%`);

    return res.json({
      success: true,
      usersProcessed: totalUsersProcessed,
      transactionsSynced: totalTransactionsSynced,
      totalUsersFound: userIds.length,
      duration: `${duration}ms`
    });

  } catch (error) {
    log(`💥 Critical sync failure: ${error.message}`);
    error(`🚨 Sync error: ${error.message}`);
    return res.json({ success: false, error: error.message });
  }
};

// Helper functions
async function processTransaction(databases, account, transaction, userId, log) {
  // Generate unique document ID to prevent duplicates
  const providerTransactionId = transaction.transactionId;
  const fallbackIdBase = transaction.internalTransactionId ||
    `${account.accountId}_${transaction.bookingDate || ''}_${transaction.transactionAmount?.amount || ''}_${transaction.remittanceInformationUnstructured || transaction.additionalInformation || ''}`;

  const rawKey = (providerTransactionId || fallbackIdBase || '').toString();
  let docIdCandidate = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (!docIdCandidate || docIdCandidate.length > 36) {
    const hashed = createHash('sha1').update(rawKey).digest('hex');
    docIdCandidate = hashed.slice(0, 36);
  }

  const docId = docIdCandidate || ID.unique();

  // Check if transaction already exists
  try {
    await databases.getDocument(global.DATABASE_ID, global.TRANSACTIONS_COLLECTION_ID, docId);
    return; // Already exists, skip
  } catch (error) {
    // Not found, proceed with creation
  }

  // Get category
  const txDescription = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  let category = 'Uncategorized';

  try {
    log(`🏷️ Categorizing transaction: ${txDescription.substring(0, 50)}...`);
    const existingCategory = await findExistingCategory(
      databases,
      global.DATABASE_ID,
      global.TRANSACTIONS_COLLECTION_ID,
      userId,
      txDescription
    );
    category = existingCategory || suggestCategory(
      txDescription,
      transaction.creditorName || transaction.debtorName || '',
      transaction.transactionAmount?.amount
    );
    log(`🏷️ Categorized as: ${category}`);
  } catch (error) {
    log(`❌ Error getting category: ${error.message}`);
    category = 'Uncategorized';
  }

  // Store transaction
  log(`💾 Storing transaction in database: ${docId}`);
  await databases.createDocument(
    global.DATABASE_ID,
    global.TRANSACTIONS_COLLECTION_ID,
    docId,
    {
      userId: userId,
      accountId: account.accountId,
      transactionId: (providerTransactionId || transaction.internalTransactionId || docId).toString().slice(0, 255),
      amount: String(transaction.transactionAmount?.amount ?? '0'),
      currency: (transaction.transactionAmount?.currency || 'EUR').toString().toUpperCase().slice(0, 3),
      bookingDate: transaction.bookingDate ? String(transaction.bookingDate).slice(0, 10) : null,
      bookingDateTime: transaction.bookingDateTime ? String(transaction.bookingDateTime).slice(0, 25) : null,
      valueDate: transaction.valueDate ? String(transaction.valueDate).slice(0, 10) : null,
      description: (transaction.remittanceInformationUnstructured || transaction.additionalInformation || '').toString().slice(0, 500),
      counterparty: (transaction.creditorName || transaction.debtorName || '').toString().slice(0, 255),
      category: category,
      raw: JSON.stringify(transaction).slice(0, 10000),
    }
  );
  log(`✅ Transaction stored successfully: ${docId}`);
}

async function updateAccountBalances(databases, accountId, userId, log) {
  try {
    log(`📡 Fetching balances from GoCardless for account ${accountId}`);
    const balancesResponse = await getBalances(accountId);
    const balances = balancesResponse?.balances || [];

    log(`📊 Found ${balances.length} balance records for account ${accountId}`);

    for (const balance of balances) {
      const balanceType = balance.balanceType || 'closingBooked';
      const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
      const amount = balance.balanceAmount?.amount || '0';

      // Check if balance already exists
      try {
        const existingBalances = await databases.listDocuments(
          global.DATABASE_ID,
          global.BALANCES_COLLECTION_ID,
          [
            Query.equal('accountId', accountId),
            Query.equal('balanceType', balanceType),
            Query.equal('referenceDate', referenceDate)
          ]
        );

        if (existingBalances.documents.length > 0) {
          log(`⏭️ Balance for ${accountId} ${balanceType} ${referenceDate} already exists, skipping`);
          continue;
        }
      } catch (queryError) {
        log('❌ Error checking existing balance, proceeding with creation');
      }

      // Create balance record
      log(`💾 Storing balance: ${amount} ${balance.balanceAmount?.currency} for ${accountId}`);
      await databases.createDocument(
        global.DATABASE_ID,
        global.BALANCES_COLLECTION_ID,
        ID.unique(),
        {
          userId: userId,
          accountId: accountId,
          balanceAmount: amount,
          currency: balance.balanceAmount?.currency || 'EUR',
          balanceType: balanceType,
          referenceDate: referenceDate,
        }
      );
      log(`✅ Balance stored successfully for account ${accountId}`);
    }
  } catch (error) {
    log(`❌ Error updating balances for account ${accountId}: ${error.message}`);
  }
}
