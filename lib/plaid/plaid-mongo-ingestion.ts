import { getDb } from '@/lib/mongo/client';
import { suggestCategory } from '@/lib/server/categorize';
import { mapPlaidCategory } from './adapters';
import { encryptPlaidTransactionFields } from '@/lib/mongo/explicit-encryption';
import {
  toPlaidTransactionRecord,
  PlaidTransactionRecord,
  PLAID_TRANSACTION_INDEXES,
  PLAID_TRANSACTION_ENCRYPTION_CONFIG
} from './transactions-plaid';

/**
 * Store a single Plaid transaction in the dedicated transactions_plaid table
 */
export async function storePlaidTransactionRecord(
  userId: string,
  accountId: string,
  plaidTransaction: any
): Promise<void> {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  // Categorize the transaction before storing
  const txDescription = plaidTransaction.name || plaidTransaction.original_description || '';
  const counterparty = plaidTransaction.merchant_name || '';

  // Map Plaid categories first, then use OpenAI as fallback
  let category = mapPlaidCategory(
    plaidTransaction.category,
    plaidTransaction.personal_finance_category
  );

  if (!category) {
    category = await suggestCategory(
      txDescription,
      counterparty,
      plaidTransaction.amount,
      plaidTransaction.iso_currency_code
    );
  }

  // Create the enhanced transaction record
  const transactionRecord = toPlaidTransactionRecord(plaidTransaction, userId, accountId);

  // Set the determined category
  transactionRecord.category = category;

  // Encrypt the transaction record
  const encryptedRecord = await encryptPlaidTransactionFields(transactionRecord);

  // Ensure indexes exist
  await ensurePlaidTransactionIndexes(db);

  try {
    await coll.insertOne(encryptedRecord);
    console.log(`✅ Stored encrypted Plaid transaction ${transactionRecord.transactionId} in transactions_plaid`);
  } catch (e: any) {
    // Handle duplicate key errors silently
    if (e.code === 11000) {
      console.log(`Transaction ${transactionRecord.transactionId} already exists in transactions_plaid, updating...`);
      // Update existing transaction with new data
      const updatedRecord = {
        ...transactionRecord,
        updatedAt: new Date().toISOString()
      };
      const encryptedUpdatedRecord = await encryptPlaidTransactionFields(updatedRecord);

      await coll.updateOne(
        { userId, transactionId: transactionRecord.transactionId },
        { $set: encryptedUpdatedRecord }
      );
    } else {
      throw e;
    }
  }
}

/**
 * Bulk store multiple Plaid transactions in the transactions_plaid table
 */
export async function storePlaidTransactionRecordsBulk(
  userId: string,
  accountId: string,
  transactions: any[]
): Promise<void> {
  if (!transactions || transactions.length === 0) {
    return;
  }

  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  // Ensure indexes exist
  await ensurePlaidTransactionIndexes(db);

  const records: PlaidTransactionRecord[] = [];

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

    // Create the enhanced transaction record
    const transactionRecord = toPlaidTransactionRecord(transaction, userId, accountId);

    // Set the determined category
    transactionRecord.category = category;

    records.push(transactionRecord);
  }

  if (records.length > 0) {
    // Encrypt all records before insertion
    const encryptedRecords = [];
    for (const record of records) {
      const encryptedRecord = await encryptPlaidTransactionFields(record);
      encryptedRecords.push(encryptedRecord);
    }

    try {
      await coll.insertMany(encryptedRecords, { ordered: false });
      console.log(`✅ Bulk stored ${encryptedRecords.length} encrypted Plaid transactions in transactions_plaid`);
    } catch (e: any) {
      if (e.code === 11000) {
        console.log(`Some transactions already existed in transactions_plaid, updating duplicates...`);
        // Handle duplicates by updating existing records
        await handleBulkDuplicates(records, userId);
      } else {
        throw e;
      }
    }
  }
}

/**
 * Handle duplicates in bulk insertion by updating existing records
 */
async function handleBulkDuplicates(records: PlaidTransactionRecord[], userId: string): Promise<void> {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  for (const record of records) {
    try {
      const updatedRecord = {
        ...record,
        updatedAt: new Date().toISOString()
      };
      const encryptedUpdatedRecord = await encryptPlaidTransactionFields(updatedRecord);

      await coll.updateOne(
        { userId, transactionId: record.transactionId },
        { $set: encryptedUpdatedRecord },
        { upsert: true }
      );
    } catch (e: any) {
      console.error(`Failed to update transaction ${record.transactionId}:`, e);
    }
  }
}

/**
 * Ensure the required indexes exist for the transactions_plaid collection
 */
async function ensurePlaidTransactionIndexes(db: any): Promise<void> {
  const coll = db.collection('transactions_plaid');

  for (const indexSpec of PLAID_TRANSACTION_INDEXES) {
    try {
      await coll.createIndex(indexSpec, {
        name: `idx_${Object.keys(indexSpec).join('_')}`,
        background: true
      });
    } catch (e: any) {
      if (e.code !== 85) { // 85 = IndexKeySpecsConflict, ignore if index already exists
        console.warn('Failed to create index:', indexSpec, e.message);
      }
    }
  }
}

/**
 * Query transactions from the transactions_plaid table
 */
export async function queryPlaidTransactions(
  userId: string,
  options: {
    accountId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    category?: string;
    pending?: boolean;
    paymentChannel?: string;
    counterparty?: string;
    search?: string;
  } = {}
): Promise<{ transactions: PlaidTransactionRecord[]; total: number }> {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  // Build query
  const query: any = { userId };

  if (options.accountId) {
    query.accountId = options.accountId;
  }

  if (options.from || options.to) {
    query.bookingDate = {};
    if (options.from) query.bookingDate.$gte = options.from;
    if (options.to) query.bookingDate.$lte = options.to;
  }

  if (options.category) {
    query.category = options.category;
  }

  if (options.pending !== undefined) {
    query.pending = options.pending;
  }

  if (options.paymentChannel) {
    query.paymentChannel = options.paymentChannel;
  }

  if (options.counterparty) {
    query.counterparty = { $regex: options.counterparty, $options: 'i' };
  }

  if (options.search) {
    query.$or = [
      { description: { $regex: options.search, $options: 'i' } },
      { counterparty: { $regex: options.search, $options: 'i' } },
      { merchantName: { $regex: options.search, $options: 'i' } },
    ];
  }

  // Get total count
  const total = await coll.countDocuments(query);

  // Build cursor
  let cursor = coll.find(query).sort({ bookingDate: -1, transactionId: -1 });

  if (options.offset) {
    cursor = cursor.skip(options.offset);
  }

  if (options.limit) {
    cursor = cursor.limit(options.limit);
  }

  const transactions = await cursor.toArray();

  return {
    transactions: transactions as PlaidTransactionRecord[],
    total
  };
}

/**
 * Get transaction analytics from transactions_plaid table
 */
export async function getPlaidTransactionAnalytics(
  userId: string,
  options: {
    from?: string;
    to?: string;
    accountId?: string;
  } = {}
): Promise<{
  totalSpent: number;
  totalIncome: number;
  transactionCount: number;
  categoryBreakdown: { category: string; amount: number; count: number }[];
  monthlyTrend: { month: string; income: number; expenses: number }[];
  topMerchants: { merchant: string; amount: number; count: number }[];
}> {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  // Build base query
  const query: any = { userId, category: { $ne: null } };

  if (options.accountId) {
    query.accountId = options.accountId;
  }

  if (options.from || options.to) {
    query.bookingDate = {};
    if (options.from) query.bookingDate.$gte = options.from;
    if (options.to) query.bookingDate.$lte = options.to;
  }

  // Aggregation pipeline
  const pipeline = [
    { $match: query },
    {
      $addFields: {
        amountNum: { $toDouble: "$amount" },
        month: "$bookingMonth"
      }
    },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalSpent: {
                $sum: { $cond: [{ $lt: ["$amountNum", 0] }, { $abs: "$amountNum" }, 0] }
              },
              totalIncome: {
                $sum: { $cond: [{ $gte: ["$amountNum", 0] }, "$amountNum", 0] }
              },
              transactionCount: { $sum: 1 }
            }
          }
        ],
        categoryBreakdown: [
          {
            $group: {
              _id: "$category",
              amount: { $sum: { $abs: "$amountNum" } },
              count: { $sum: 1 }
            }
          },
          { $sort: { amount: -1 } },
          { $limit: 10 }
        ],
        monthlyTrend: [
          {
            $group: {
              _id: "$month",
              income: {
                $sum: { $cond: [{ $gte: ["$amountNum", 0] }, "$amountNum", 0] }
              },
              expenses: {
                $sum: { $cond: [{ $lt: ["$amountNum", 0] }, { $abs: "$amountNum" }, 0] }
              }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 12 }
        ],
        topMerchants: [
          {
            $group: {
              _id: "$counterparty",
              amount: { $sum: { $abs: "$amountNum" } },
              count: { $sum: 1 }
            }
          },
          { $sort: { amount: -1 } },
          { $limit: 10 }
        ]
      }
    }
  ];

  const result = await coll.aggregate(pipeline).toArray();
  const facets = result[0];

  return {
    totalSpent: facets.totals[0]?.totalSpent || 0,
    totalIncome: facets.totals[0]?.totalIncome || 0,
    transactionCount: facets.totals[0]?.transactionCount || 0,
    categoryBreakdown: facets.categoryBreakdown.map((item: any) => ({
      category: item._id || 'Uncategorized',
      amount: item.amount,
      count: item.count
    })),
    monthlyTrend: facets.monthlyTrend.map((item: any) => ({
      month: item._id,
      income: item.income,
      expenses: item.expenses
    })),
    topMerchants: facets.topMerchants.map((item: any) => ({
      merchant: item._id || 'Unknown',
      amount: item.amount,
      count: item.count
    }))
  };
}

/**
 * Delete transactions for a specific account (useful for account removal)
 */
export async function deletePlaidTransactionsByAccount(
  userId: string,
  accountId: string
): Promise<number> {
  const db = await getDb();
  const coll = db.collection('transactions_plaid');

  const result = await coll.deleteMany({ userId, accountId });
  console.log(`🗑️ Deleted ${result.deletedCount} transactions for account ${accountId}`);
  return result.deletedCount || 0;
}

/**
 * Sync transactions for a Plaid account (handles both initial sync and updates)
 */
export async function syncPlaidAccountTransactions(
  userId: string,
  accessToken: string,
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<{
    added: number;
    updated: number;
    total: number;
  }> {
  const { getTransactions } = await import('../plaid');

  // Default to last 30 days if no date range provided
  const defaultStartDate = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString().split('T')[0];
  const defaultEndDate = new Date().toISOString().split('T')[0];

  const transactionsResponse = await getTransactions(accessToken, {
    startDate: startDate || defaultStartDate,
    endDate: endDate || defaultEndDate,
    count: 500,
  });

  if (!transactionsResponse.transactions || transactionsResponse.transactions.length === 0) {
    return { added: 0, updated: 0, total: 0 };
  }

  // Store transactions using the enhanced table
  await storePlaidTransactionRecordsBulk(
    userId,
    accountId,
    transactionsResponse.transactions
  );

  return {
    added: transactionsResponse.transactions.length,
    updated: 0, // We don't track updates separately in this implementation
    total: transactionsResponse.transactions.length
  };
}