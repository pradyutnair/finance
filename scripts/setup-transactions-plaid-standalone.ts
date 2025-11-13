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

      return;
    }

    // Create the collection with validation rules
    await db.createCollection('transactions_plaid', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          title: 'Plaid Transaction Record',
          required: ['transactionId', 'accountId', 'userId', 'amount', 'currency', 'description', 'createdAt'],
          properties: {
            transactionId: {
              bsonType: 'string',
              description: 'Unique transaction identifier from Plaid',
              maxLength: 255
            },
            accountId: {
              bsonType: 'string',
              description: 'Bank account identifier'
            },
            userId: {
              bsonType: 'string',
              description: 'User identifier'
            },
            amount: {
              bsonType: 'string',
              description: 'Transaction amount as string'
            },
            currency: {
              bsonType: 'string',
              description: 'Currency code (e.g., USD)',
              enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'SEK', 'NZD']
            },
            bookingDate: {
              bsonType: ['string', 'null'],
              description: 'Date transaction was booked (YYYY-MM-DD format)',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            bookingMonth: {
              bsonType: ['string', 'null'],
              description: 'Month in YYYY-MM format for grouping',
              pattern: '^\\d{4}-\\d{2}$'
            },
            bookingYear: {
              bsonType: ['number', 'null'],
              description: 'Year for grouping',
              minimum: 2000,
              maximum: 2100
            },
            bookingWeekday: {
              bsonType: ['string', 'null'],
              description: 'Day of week (Mon, Tue, etc.)',
              enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            },
            valueDate: {
              bsonType: ['string', 'null'],
              description: 'Date transaction value was received',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            authorizedDate: {
              bsonType: ['string', 'null'],
              description: 'Date transaction was authorized',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            bookingDateTime: {
              bsonType: ['string', 'null'],
              description: 'Full ISO datetime for booking'
            },
            status: {
              bsonType: ['string', 'null'],
              description: 'Transaction status',
              enum: ['pending', 'posted', 'completed']
            },
            pending: {
              bsonType: 'bool',
              description: 'Whether transaction is pending'
            },
            paymentChannel: {
              bsonType: ['string', 'null'],
              description: 'Payment channel used',
              enum: ['online', 'in store', 'mobile', 'other', 'null']
            },
            category: {
              bsonType: ['string', 'null'],
              description: 'Transaction category',
              maxLength: 100
            },
            exclude: {
              bsonType: 'bool',
              description: 'Whether to exclude from analytics'
            },
            description: {
              bsonType: 'string',
              description: 'Transaction description',
              maxLength: 500
            },
            counterparty: {
              bsonType: 'string',
              description: 'Transaction counterparty',
              maxLength: 255
            },
            merchantName: {
              bsonType: ['string', 'null'],
              description: 'Merchant name from Plaid'
            },
            originalDescription: {
              bsonType: ['string', 'null'],
              description: 'Original description from bank'
            },
            transactionCode: {
              bsonType: ['string', 'null'],
              description: 'Transaction code from Plaid'
            },
            transactionType: {
              bsonType: ['string', 'null'],
              description: 'Transaction type from Plaid'
            },
            checkNumber: {
              bsonType: ['string', 'null'],
              description: 'Check number for check transactions'
            },
            location: {
              bsonType: ['object', 'null'],
              description: 'Transaction location data',
              properties: {
                address: { bsonType: ['string', 'null'] },
                city: { bsonType: ['string', 'null'] },
                region: { bsonType: ['string', 'null'] },
                postalCode: { bsonType: ['string', 'null'] },
                country: { bsonType: ['string', 'null'] },
                lat: { bsonType: ['number', 'null'] },
                lon: { bsonType: ['number', 'null'] },
                storeNumber: { bsonType: ['string', 'null'] }
              }
            },
            counterparties: {
              bsonType: ['array', 'null'],
              description: 'Array of counterparty information',
              items: {
                bsonType: 'object',
                properties: {
                  name: { bsonType: 'string' },
                  type: { bsonType: 'string' },
                  website: { bsonType: ['string', 'null'] },
                  logoUrl: { bsonType: ['string', 'null'] },
                  confidenceLevel: { bsonType: ['string', 'null'] },
                  entityId: { bsonType: ['string', 'null'] },
                  accountNumbers: {
                bsonType: ['object', 'null'],
                properties: {
                  bacs: {
                    bsonType: ['object', 'null'],
                    properties: {
                      account: { bsonType: ['string', 'null'] },
                      sortCode: { bsonType: ['string', 'null'] }
                    }
                  },
                  international: {
                    bsonType: ['object', 'null'],
                    properties: {
                      iban: { bsonType: ['string', 'null'] },
                      bic: { bsonType: ['string', 'null'] }
                    }
                  }
                }
              }
            }
          }
        },
        personalFinanceCategory: {
          bsonType: ['object', 'null'],
          description: 'Personal finance category from Plaid',
          properties: {
            primary: { bsonType: ['string', 'null'] },
            detailed: { bsonType: ['string', 'null'] },
            confidenceLevel: { bsonType: ['string', 'null'] },
            iconUrl: { bsonType: ['string', 'null'] }
          }
        },
        merchantEntityId: {
          bsonType: ['string', 'null'],
          description: 'Merchant entity ID from Plaid'
        },
        logoUrl: {
          bsonType: ['string', 'null'],
          description: 'Merchant logo URL'
        },
        website: {
          bsonType: ['string', 'null'],
          description: 'Merchant website'
        },
        paymentMeta: {
          bsonType: ['object', 'null'],
          description: 'Payment metadata from Plaid',
          properties: {
            referenceNumber: { bsonType: ['string', 'null'] },
            ppdId: { bsonType: ['string', 'null'] },
            payee: { bsonType: ['string', 'null'] },
            byOrderOf: { bsonType: ['string', 'null'] },
            payer: { bsonType: ['string', 'null'] },
            paymentMethod: { bsonType: ['string', 'null'] },
            paymentProcessor: { bsonType: ['string', 'null'] },
            reason: { bsonType: ['string', 'null'] }
          }
        },
        pendingTransactionId: {
          bsonType: ['string', 'null'],
          description: 'Reference to pending transaction'
        },
        raw: {
          bsonType: ['object', 'null'],
          description: 'Raw Plaid transaction data'
        },
        createdAt: {
          bsonType: 'string',
          description: 'Record creation timestamp'
        },
        updatedAt: {
          bsonType: ['string', 'null'],
          description: 'Record update timestamp'
        }
      }
    }
  }
});

    console.log('✅ Created transactions_plaid collection with validation schema');

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