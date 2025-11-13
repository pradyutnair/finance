import { getDb } from '@/lib/mongo/client';
import { suggestCategory, findExistingCategoryMongo } from '@/lib/server/categorize';
import {
  encryptRequisitionFields,
  encryptBankConnectionFields,
  encryptBankAccountFields,
  encryptBalanceFields,
  encryptTransactionFields
} from '@/lib/mongo/explicit-encryption';
import { Client, Databases, ID } from 'appwrite';
import { createAppwriteClient } from '@/lib/auth';
import {
  toPublicBankConnection,
  toSensitiveBankConnection,
  toPublicBankAccount,
  toSensitiveBankAccount,
  toPublicBankBalance,
  toSensitiveBankBalance,
  toPublicTransaction,
  toSensitiveTransaction,
  mergeBankConnectionData,
  mergeBankAccountData,
  mergeBankBalanceData,
  mergeTransactionData,
  mapPlaidCategory,
  PublicItem,
  SensitiveItem,
  PublicBankConnection,
  SensitiveBankConnection,
  PublicBankAccount,
  SensitiveBankAccount,
  PublicBankBalance,
  SensitiveBankBalance,
  PublicTransaction,
  SensitiveTransaction,
} from '@/lib/plaid/adapters';

/**
 * Store Plaid item (equivalent to GoCardless requisition) in MongoDB
 */
export async function storeItemMongo(
  plaidItemResponse: any,
  userId: string,
  accessToken: string,
  institutionName?: string
) {
  const db = await getDb();
  const coll = db.collection('requisitions_dev'); // Keep same collection name for compatibility

  const publicItem = toPublicItem(plaidItemResponse, userId, institutionName);
  const sensitiveItem = toSensitiveItem(plaidItemResponse, accessToken);

  // Merge for storage, maintaining encryption
  const itemData = {
    ...publicItem,
    ...sensitiveItem,
    // Plaid-specific fields
    itemId: publicItem.itemId,
    institutionId: publicItem.institutionId,
    institutionName: publicItem.institutionName,
    status: publicItem.status,
    accessToken: sensitiveItem.accessToken, // Will be encrypted
    webhookEnabled: sensitiveItem.webhookEnabled,
    metadata: sensitiveItem.metadata,
  };

  await coll.updateOne(
    { userId, itemId: publicItem.itemId },
    {
      $set: itemData,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

/**
 * Store Plaid bank connection in Appwrite
 */
export async function storePlaidBankConnectionAppwrite(
  userId: string,
  plaidItem: any,
  institutionMetadata?: any
) {
  try {
    const client = createAppwriteClient();
    const databases = new Databases(client);

    const connectionData = {
      userId,
      institutionId: institutionMetadata?.institution_id || plaidItem.institution_id || 'unknown',
      institutionName: institutionMetadata?.name || 'Unknown Bank',
      status: 'active', // Plaid connections are active when created
      itemId: plaidItem.item_id, // Plaid equivalent of requisitionId
      logoUrl: institutionMetadata?.logo || undefined,
      transactionTotalDays: institutionMetadata?.transaction_total_days || 730, // Default 2 years
      maxAccessValidForDays: undefined, // Plaid access doesn't expire unless revoked
    };

    // Remove undefined values
    const filteredData: any = {};
    for (const [key, value] of Object.entries(connectionData)) {
      if (value !== undefined) {
        filteredData[key] = value;
      }
    }

    const connectionDoc = await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string,
      process.env.NEXT_PUBLIC_APPWRITE_BANK_CONNECTIONS_COLLECTION_ID as string,
      ID.unique(),
      filteredData
    );

    console.log('✅ Created Plaid bank connection in Appwrite:', connectionDoc.$id);
    return connectionDoc;
  } catch (error) {
    console.error('❌ Failed to create Plaid bank connection in Appwrite:', error);
    throw error;
  }
}

/**
 * Store Plaid bank connection in MongoDB
 */
export async function storePlaidBankConnectionMongo(
  userId: string,
  plaidItem: any,
  accessToken: string,
  institutionMetadata?: any
) {
  const db = await getDb();
  const coll = db.collection('bank_connections_dev');

  const publicConnection = toPublicBankConnection(plaidItem, userId, institutionMetadata);
  const sensitiveConnection = toSensitiveBankConnection(plaidItem, accessToken);

  // Merge for storage, maintaining encryption
  const connectionData = {
    ...publicConnection,
    ...sensitiveConnection,
    // Additional metadata for compatibility
    itemId: publicConnection.itemId,
    accessToken: sensitiveConnection.accessToken, // Will be encrypted
    accounts: sensitiveConnection.accounts,
    metadata: sensitiveConnection.metadata,
  };

  // Separate query fields from update fields to avoid MongoDB conflict
  const { userId: _userId, institutionId: _institutionId, itemId: _itemId, ...updateFields } = connectionData;

  // Filter out null values (can't encrypt null)
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }

  await coll.updateOne(
    { userId, institutionId: publicConnection.institutionId },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        institutionId: publicConnection.institutionId,
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

/**
 * Store Plaid bank account in MongoDB
 */
export async function storePlaidBankAccountMongo(
  accountId: string,
  userId: string,
  plaidAccount: any,
  institutionId: string,
  institutionName?: string
) {
  const db = await getDb();
  const coll = db.collection('bank_accounts_dev');

  const publicAccount = toPublicBankAccount(plaidAccount, userId, accountId, institutionId, institutionName);
  const sensitiveAccount = toSensitiveBankAccount(plaidAccount);

  // Merge for storage
  const accountData = {
    ...publicAccount,
    ...sensitiveAccount,
    // Additional fields for compatibility
    accountId: publicAccount.accountId,
    institutionId: publicAccount.institutionId,
    institutionName: publicAccount.institutionName,
  };

  // Separate query fields from update fields to avoid MongoDB conflict
  const { userId: _userId, accountId: encryptedAccountId, ...updateFields } = accountData;

  // Filter out null values (can't encrypt null)
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }

  await coll.updateOne(
    { accountId: encryptedAccountId, userId },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        accountId: encryptedAccountId,
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

/**
 * Store Plaid balance in MongoDB
 */
export async function storePlaidBalanceMongo(
  userId: string,
  accountId: string,
  plaidBalance: any
) {
  const db = await getDb();
  const coll = db.collection('balances_dev');

  const publicBalance = toPublicBankBalance(plaidBalance, userId, accountId);
  const sensitiveBalance = toSensitiveBankBalance(plaidBalance);

  // Merge for storage
  const balanceData = {
    ...publicBalance,
    ...sensitiveBalance,
    // Additional fields for compatibility
    accountId: publicBalance.accountId,
    balanceType: publicBalance.balanceType,
    referenceDate: publicBalance.referenceDate,
  };

  // Separate query fields from update fields to avoid MongoDB conflict
  const {
    userId: _userId,
    accountId: encryptedAccountId,
    balanceType,
    referenceDate,
    ...updateFields
  } = balanceData;

  // Filter out null values
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }

  await coll.updateOne(
    { userId, accountId: encryptedAccountId, balanceType, referenceDate },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        accountId: encryptedAccountId,
        balanceType,
        referenceDate,
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

/**
 * Store Plaid transaction in MongoDB
 */
export async function storePlaidTransactionMongo(
  userId: string,
  accountId: string,
  plaidTransaction: any
) {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  const txDescription = plaidTransaction.name || plaidTransaction.original_description || '';
  const counterparty = plaidTransaction.merchant_name || '';
  const providerTransactionId = plaidTransaction.transaction_id || '';

  // CRITICAL: Categorize on PLAINTEXT data from Plaid BEFORE encryption
  // Map Plaid categories first, then use OpenAI as fallback
  let category = mapPlaidCategory(
    plaidTransaction.category,
    plaidTransaction.personal_finance_category
  );

  if (!category) {
    // Use OpenAI as fallback for uncategorized transactions
    category = await suggestCategory(
      txDescription,
      counterparty,
      plaidTransaction.amount,
      plaidTransaction.iso_currency_code
    );
  }

  // Create transaction data with existing adapters
  const publicTransaction = toPublicTransaction(plaidTransaction, userId, accountId);
  const sensitiveTransaction = toSensitiveTransaction(plaidTransaction);

  // Merge for storage with category
  const transactionData = {
    ...publicTransaction,
    ...sensitiveTransaction,
    category, // Add the determined category
  };

  // Filter out null values (can't encrypt null)
  const doc: any = {};
  for (const [key, value] of Object.entries(transactionData)) {
    if (value !== null && value !== undefined) {
      doc[key] = value;
    }
  }

  try {
    await coll.insertOne(doc);
  } catch (e: any) {
    // Handle duplicate key errors silently
    if (e.code === 11000) {
      console.log(`Transaction ${providerTransactionId} already exists, skipping`);
    } else {
      throw e;
    }
  }
}

/**
 * Bulk store multiple Plaid transactions
 */
export async function storePlaidTransactionsBulkMongo(
  userId: string,
  accountId: string,
  transactions: any[]
) {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  const documents = [];

  for (const transaction of transactions) {
    const txDescription = transaction.name || transaction.original_description || '';
    const counterparty = transaction.merchant_name || '';

    // Map Plaid categories first, then use OpenAI as fallback
    let category = mapPlaidCategory(
      transaction.category,
      transaction.personal_finance_category
    );

    if (!category) {
      category = await suggestCategory(
        txDescription,
        counterparty,
        transaction.amount,
        transaction.iso_currency_code
      );
    }

    const publicTransaction = toPublicTransaction(transaction, userId, accountId);
    const sensitiveTransaction = toSensitiveTransaction(transaction);

    // Merge for storage with category
    const transactionData = {
      ...publicTransaction,
      ...sensitiveTransaction,
      category,
    };

    // Filter out null values
    const doc: any = {};
    for (const [key, value] of Object.entries(transactionData)) {
      if (value !== null && value !== undefined) {
        doc[key] = value;
      }
    }

    documents.push(doc);
  }

  if (documents.length > 0) {
    try {
      await coll.insertMany(documents, { ordered: false });
    } catch (e: any) {
      // Handle duplicate key errors for bulk insert
      if (e.code === 11000) {
        console.log(`Some transactions already existed, continuing...`);
        // Could filter duplicates here if needed
      } else {
        throw e;
      }
    }
  }
}

/**
 * Initial data sync for a newly connected Plaid item
 */
export async function syncPlaidItemData(
  userId: string,
  accessToken: string,
  plaidItemResponse: any,
  accountsResponse: any,
  transactionsResponse: any,
  institutionMetadata?: any
) {
  try {
    // Store the item/connection in MongoDB only (Appwrite storage disabled due to schema issues)
    await storePlaidBankConnectionMongo(userId, plaidItemResponse.item, accessToken, institutionMetadata);

    // Store all accounts
    for (const account of accountsResponse.accounts) {
      await storePlaidBankAccountMongo(
        account.account_id,
        userId,
        account,
        plaidItemResponse.item.institution_id,
        institutionMetadata?.name
      );

      // Store account balances
      await storePlaidBalanceMongo(userId, account.account_id, account.balances);
    }

    // Store all transactions
    if (transactionsResponse.transactions?.length > 0) {
      // Group transactions by account for bulk insertion
      const transactionsByAccount = new Map<string, any[]>();

      for (const transaction of transactionsResponse.transactions) {
        const accountId = transaction.account_id;
        if (!transactionsByAccount.has(accountId)) {
          transactionsByAccount.set(accountId, []);
        }
        transactionsByAccount.get(accountId)!.push(transaction);
      }

      // Bulk insert transactions per account
      for (const [accountId, accountTransactions] of transactionsByAccount) {
        await storePlaidTransactionsBulkMongo(userId, accountId, accountTransactions);
      }
    }

    console.log(`✅ Synced Plaid data for user ${userId}:`, {
      accounts: accountsResponse.accounts.length,
      transactions: transactionsResponse.transactions?.length || 0,
      institution: institutionMetadata?.name,
    });

  } catch (error) {
    console.error('❌ Error syncing Plaid item data:', error);
    throw error;
  }
}