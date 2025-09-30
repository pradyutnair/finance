/**
 * Appwrite Function for ongoing GoCardless transaction sync
 * Runs 4 times daily to fetch latest transactions and update database
 */

const { Client, Databases, Query, ID } = require('appwrite');
const { getTransactions, getAccounts, getBalances, getInstitution, HttpError } = require('./lib/gocardless.js');
const { createHash } = require('crypto');

// Import the existing categorization functions
async function loadCategorizeModule() {
  // In a real deployment, you'd need to transpile the TypeScript or use a different approach
  // For now, we'll use a simplified version that matches the existing logic
  return {
    suggestCategory: async (description, counterparty, amount, currency) => {
      // Use simple heuristic-based categorization matching the existing logic
      const text = `${counterparty || ''} ${description || ''}`.toLowerCase().trim();
      const value = parseFloat(amount || '0');

      // Basic categorization logic (simplified from existing categorize.ts)
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
    },

    findExistingCategory: async (databases, databaseId, collectionId, userId, description) => {
      // Simplified version of findExistingCategory
      try {
        const response = await databases.listDocuments(
          databaseId,
          collectionId,
          [
            databases.Query.equal('userId', userId),
            databases.Query.search('description', description.slice(0, 50)),
            databases.Query.limit(5)
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
        console.error('[Categorize] Error finding existing category:', error);
        return null;
      }
    }
  };
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

// Configuration
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';
const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

// Rate limiting configuration
const API_CALL_DELAY_MS = 1000; // 1 second between API calls
const MAX_ACCOUNTS_PER_BATCH = 5; // Process accounts in small batches
const MAX_USERS_PER_EXECUTION = 10; // Limit users per execution to avoid timeouts

// Utility function for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncUserTransactions(userId, categorizeModule) {
  console.log(`[Sync] Starting sync for user: ${userId}`);

  try {
    // Get all bank accounts for this user
    const accountsResponse = await databases.listDocuments(
      DATABASE_ID,
      BANK_ACCOUNTS_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('status', 'active')
      ]
    );

    const accounts = accountsResponse.documents;
    console.log(`[Sync] Found ${accounts.length} active accounts for user ${userId}`);

    let totalTransactionsSynced = 0;

    // Process accounts in batches with rate limiting
    for (let i = 0; i < accounts.length; i += MAX_ACCOUNTS_PER_BATCH) {
      const accountBatch = accounts.slice(i, i + MAX_ACCOUNTS_PER_BATCH);
      console.log(`[Sync] Processing account batch ${Math.floor(i / MAX_ACCOUNTS_PER_BATCH) + 1}/${Math.ceil(accounts.length / MAX_ACCOUNTS_PER_BATCH)} (${accountBatch.length} accounts)`);

      for (let j = 0; j < accountBatch.length; j++) {
        const account = accountBatch[j];
        const accountId = account.accountId;

        try {
          console.log(`[Sync] Processing account: ${accountId} (${j + 1}/${accountBatch.length})`);

          // Get transactions from GoCardless
          const transactionsResponse = await getTransactions(accountId);
          const transactions = transactionsResponse?.transactions?.booked || [];

          console.log(`[Sync] Retrieved ${transactions.length} transactions for account ${accountId}`);

          // Process and store transactions
          for (const transaction of transactions.slice(0, 100)) { // Limit to avoid overwhelming
            try {
              await processTransaction(account, transaction, userId, categorizeModule);
              totalTransactionsSynced++;
            } catch (error) {
              if (error.message?.includes('already exists') || error.code === 409) {
                // Duplicate transaction, skip
                console.log(`[Sync] Transaction already exists for ${accountId}`);
              } else {
                console.error(`[Sync] Error processing transaction for account ${accountId}:`, error);
              }
            }
          }

          // Update balances if needed
          try {
            await updateAccountBalances(accountId, userId);
          } catch (error) {
            console.error(`[Sync] Error updating balances for account ${accountId}:`, error);
          }

        } catch (error) {
          console.error(`[Sync] Error processing account ${accountId}:`, error);
        }

        // Add delay between accounts within a batch
        if (j < accountBatch.length - 1) {
          console.log(`[Sync] Waiting ${API_CALL_DELAY_MS}ms before next account in batch...`);
          await sleep(API_CALL_DELAY_MS / 2); // Shorter delay within batch
        }
      }

      // Add longer delay between batches
      if (i + MAX_ACCOUNTS_PER_BATCH < accounts.length) {
        console.log(`[Sync] Waiting ${API_CALL_DELAY_MS * 2}ms before next batch...`);
        await sleep(API_CALL_DELAY_MS * 2);
      }
    }

    console.log(`[Sync] Completed sync for user ${userId}. Total transactions synced: ${totalTransactionsSynced}`);
    return totalTransactionsSynced;

  } catch (error) {
    console.error(`[Sync] Error syncing user ${userId}:`, error);
    throw error;
  }
}

async function processTransaction(account, transaction, userId, categorizeModule) {
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
    await databases.getDocument(DATABASE_ID, TRANSACTIONS_COLLECTION_ID, docId);
    return; // Already exists, skip
  } catch (error) {
    // Not found, proceed with creation
  }

  // Get category
  const txDescription = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  let category = 'Uncategorized';

  try {
    const existingCategory = await categorizeModule.findExistingCategory(
      databases,
      DATABASE_ID,
      TRANSACTIONS_COLLECTION_ID,
      userId,
      txDescription
    );
    category = existingCategory || await categorizeModule.suggestCategory(
      txDescription,
      transaction.creditorName || transaction.debtorName || '',
      transaction.transactionAmount?.amount,
      transaction.transactionAmount?.currency
    );
  } catch (error) {
    console.warn('[Sync] Error getting category:', error);
    category = 'Uncategorized';
  }

  // Store transaction
  await databases.createDocument(
    DATABASE_ID,
    TRANSACTIONS_COLLECTION_ID,
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
}

async function updateAccountBalances(accountId, userId) {
  try {
    const balancesResponse = await getBalances(accountId);
    const balances = balancesResponse?.balances || [];

    for (const balance of balances) {
      const balanceType = balance.balanceType || 'closingBooked';
      const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];

      // Check if balance already exists
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
          console.log(`[Sync] Balance for ${accountId} ${balanceType} ${referenceDate} already exists, skipping`);
          continue;
        }
      } catch (queryError) {
        console.log('[Sync] Error checking existing balance, proceeding with creation');
      }

      // Create balance record
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
    }
  } catch (error) {
    console.error(`[Sync] Error updating balances for account ${accountId}:`, error);
  }
}

async function getAllUsersWithBankAccounts() {
  try {
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
    console.log(`[Sync] Found ${userIds.length} users with active bank accounts`);

    return userIds;
  } catch (error) {
    console.error('[Sync] Error getting users with bank accounts:', error);
    throw error;
  }
}

async function main() {
  const startTime = new Date();
  console.log('[Sync] Starting GoCardless transaction sync...', {
    timestamp: startTime.toISOString(),
    functionVersion: '1.0.0'
  });

  let syncResults = {
    usersProcessed: 0,
    totalTransactionsSynced: 0,
    errors: [],
    warnings: []
  };

  try {
    // Load categorize module
    const categorizeModule = await loadCategorizeModule();

    // Get all users with active bank accounts
    const userIds = await getAllUsersWithBankAccounts();

    if (userIds.length === 0) {
      console.log('[Sync] No users with active bank accounts found');
      return syncResults;
    }

    console.log(`[Sync] Found ${userIds.length} users with active bank accounts`);

    // Process users in batches to avoid overwhelming the system
    const usersToProcess = userIds.slice(0, MAX_USERS_PER_EXECUTION);
    console.log(`[Sync] Processing ${usersToProcess.length} users (limited to ${MAX_USERS_PER_EXECUTION} per execution)`);

    // Process each user with individual error handling and rate limiting
    for (let i = 0; i < usersToProcess.length; i++) {
      const userId = usersToProcess[i];

      try {
        console.log(`[Sync] Processing user ${userId} (${i + 1}/${usersToProcess.length})`);
        const transactionsSynced = await syncUserTransactions(userId, categorizeModule);
        syncResults.totalTransactionsSynced += transactionsSynced;
        syncResults.usersProcessed++;
        console.log(`[Sync] Successfully synced ${transactionsSynced} transactions for user ${userId}`);

        // Add delay between users to respect rate limits
        if (i < usersToProcess.length - 1) {
          console.log(`[Sync] Waiting ${API_CALL_DELAY_MS}ms before next user...`);
          await sleep(API_CALL_DELAY_MS);
        }

      } catch (error) {
        const errorMessage = `Failed to sync user ${userId}: ${error.message}`;
        console.error(`[Sync] ${errorMessage}`, error);
        syncResults.errors.push({
          userId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        // Continue with other users even if one fails

        // Add delay even after errors
        if (i < usersToProcess.length - 1) {
          console.log(`[Sync] Waiting ${API_CALL_DELAY_MS}ms before next user (after error)...`);
          await sleep(API_CALL_DELAY_MS);
        }
      }
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(`[Sync] Sync completed in ${duration}ms`, {
      usersProcessed: syncResults.usersProcessed,
      totalTransactionsSynced: syncResults.totalTransactionsSynced,
      errors: syncResults.errors.length,
      warnings: syncResults.warnings.length,
      successRate: `${((syncResults.usersProcessed / userIds.length) * 100).toFixed(1)}%`
    });

    // Log warnings if any
    if (syncResults.warnings.length > 0) {
      console.warn('[Sync] Warnings during sync:', syncResults.warnings);
    }

    // Log errors if any
    if (syncResults.errors.length > 0) {
      console.error('[Sync] Errors during sync:', syncResults.errors);
    }

    return syncResults;

  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.error(`[Sync] Critical sync failure after ${duration}ms:`, error);

    syncResults.errors.push({
      type: 'critical',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

// Export for Appwrite Functions
module.exports = { main };
