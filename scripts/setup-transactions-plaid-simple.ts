import { getDb } from '../lib/mongo/client';

// Index specifications for transactions_plaid table
const PLAID_TRANSACTION_INDEXES = [
  // Primary index for user lookups
  { userId: 1, bookingDate: -1 },

  // Account-specific queries
  { accountId: 1, bookingDate: -1 },

  // Transaction uniqueness
  { userId: 1, transactionId: 1 },

  // Date range queries
  { userId: 1, bookingMonth: 1 },
  { userId: 1, bookingYear: 1 },

  // Status queries
  { userId: 1, pending: 1 },
  { userId: 1, status: 1 },

  // Category queries
  { userId: 1, category: 1 },

  // Counterparty search
  { userId: 1, counterparty: 1 },

  // Payment channel queries
  { userId: 1, paymentChannel: 1 },

  // Merchant queries
  { userId: 1, merchantName: 1 },

  // Date queries
  { userId: 1, authorizedDate: -1 },
  { userId: 1, valueDate: -1 },
];

/**
 * Create the transactions_plaid collection with proper schema and indexes
 */
async function setupTransactionsPlaidCollection() {
  try {
    console.log('🚀 Starting transactions_plaid collection setup...');

    const db = await getDb();

    // Check if collection already exists
    const collections = await db.listCollections({ name: 'transactions_plaid' }).toArray();
    if (collections.length > 0) {
      console.log('✅ transactions_plaid collection already exists');

      // Verify indexes exist
      const coll = db.collection('transactions_plaid');
      const existingIndexes = await coll.listIndexes().toArray();
      console.log('📋 Existing indexes:', existingIndexes.map(idx => idx.name));

      // Create missing indexes if needed
      for (const [indexNumber, indexSpec] of PLAID_TRANSACTION_INDEXES.entries()) {
        const indexName = `idx_plaid_tx_${indexNumber}_${Object.keys(indexSpec).join('_')}`;
        const indexExists = existingIndexes.some(idx => idx.name === indexName);

        if (!indexExists) {
          try {
            await coll.createIndex(indexSpec, {
              name: indexName,
              background: true
            });
            console.log(`✅ Created missing index: ${indexName}`);
          } catch (e: any) {
            if (e.code !== 85) {
              console.warn(`⚠️ Failed to create index:`, indexSpec, e.message);
            }
          }
        }
      }

      // Check for unique index
      const uniqueIndexExists = existingIndexes.some(idx => idx.name === 'idx_unique_user_transaction');
      if (!uniqueIndexExists) {
        await coll.createIndex(
          { userId: 1, transactionId: 1 },
          {
            unique: true,
            name: 'idx_unique_user_transaction',
            background: true
          }
        );
        console.log('✅ Created unique index: idx_unique_user_transaction');
      }

      return;
    }

    // Create the collection without validation for now (simpler setup)
    await db.createCollection('transactions_plaid');
    console.log('✅ Created transactions_plaid collection');

    // Create indexes for optimal query performance
    const coll = db.collection('transactions_plaid');

    for (const [indexNumber, indexSpec] of PLAID_TRANSACTION_INDEXES.entries()) {
      try {
        await coll.createIndex(indexSpec, {
          name: `idx_plaid_tx_${indexNumber}_${Object.keys(indexSpec).join('_')}`,
          background: true
        });
        console.log(`✅ Created index: idx_plaid_tx_${indexNumber}_${Object.keys(indexSpec).join('_')}`);
      } catch (e: any) {
        if (e.code !== 85) { // 85 = IndexKeySpecsConflict, ignore if index already exists
          console.warn(`⚠️ Failed to create index:`, indexSpec, e.message);
        }
      }
    }

    // Create unique compound index for transaction uniqueness
    await coll.createIndex(
      { userId: 1, transactionId: 1 },
      {
        unique: true,
        name: 'idx_unique_user_transaction',
        background: true
      }
    );
    console.log('✅ Created unique index: idx_unique_user_transaction');

    console.log('🎉 Successfully set up transactions_plaid collection with all indexes');

  } catch (error) {
    console.error('❌ Error setting up transactions_plaid collection:', error);
    throw error;
  }
}

// Execute setup
setupTransactionsPlaidCollection()
  .then(() => {
    console.log('✅ Setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });