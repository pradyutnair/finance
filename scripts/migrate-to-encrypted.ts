/**
 * Migration script to convert existing unencrypted data to encrypted format.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-to-encrypted.ts [collection]
 * 
 * Collections: transactions, accounts, balances, connections, requisitions, all
 * 
 * Example:
 *   npx ts-node scripts/migrate-to-encrypted.ts transactions
 *   npx ts-node scripts/migrate-to-encrypted.ts all
 * 
 * IMPORTANT:
 * - Run this after creating encrypted tables in Appwrite
 * - Test with a small batch first
 * - Monitor KMS costs during migration
 * - Keep backups of original data
 */

import { Client, Databases, Query } from 'appwrite';
import {
  storeEncryptedTransaction,
  storeEncryptedBankAccount,
  storeEncryptedBalance,
  storeEncryptedRequisition,
} from '../lib/server/encryption-service';

// Configuration
const BATCH_SIZE = 50; // Process 50 records at a time
const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 second delay to avoid rate limits

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
}

// Initialize Appwrite client
function createAppwriteClient(): { client: Client; databases: Databases } {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT as string)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID as string);

  client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY as string;
  const databases = new Databases(client);

  return { client, databases };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Migrate transactions from transactions_dev to encrypted tables
 */
async function migrateTransactions(databases: Databases): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: 'transactions',
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
  };

  const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
  const SOURCE_COLLECTION = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

  console.log(`\n🔄 Migrating transactions from ${SOURCE_COLLECTION}...`);

  try {
    // Get total count
    const countResponse = await databases.listDocuments(
      DATABASE_ID,
      SOURCE_COLLECTION,
      [Query.limit(1)]
    );
    stats.total = countResponse.total;

    console.log(`📊 Total transactions to migrate: ${stats.total}`);

    // Migrate in batches
    let offset = 0;
    while (offset < stats.total) {
      console.log(`\n📦 Processing batch: ${offset + 1} - ${Math.min(offset + BATCH_SIZE, stats.total)}`);

      const batch = await databases.listDocuments(
        DATABASE_ID,
        SOURCE_COLLECTION,
        [Query.limit(BATCH_SIZE), Query.offset(offset)]
      );

      for (const doc of batch.documents) {
        try {
          // Check if already migrated
          const existingEncrypted = await databases.listDocuments(
            DATABASE_ID,
            process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc',
            [Query.equal('record_id', doc.transactionId)]
          );

          if (existingEncrypted.documents.length > 0) {
            stats.skipped++;
            console.log(`⏭️  Skipped (already migrated): ${doc.transactionId}`);
            continue;
          }

          // Reconstruct GoCardless transaction format from raw field
          const gcTransaction = doc.raw ? JSON.parse(doc.raw) : {
            transactionId: doc.transactionId,
            transactionAmount: {
              amount: doc.amount,
              currency: doc.currency,
            },
            bookingDate: doc.bookingDate,
            bookingDateTime: doc.bookingDateTime,
            valueDate: doc.valueDate,
            remittanceInformationUnstructured: doc.description,
            creditorName: doc.counterparty,
          };

          // Migrate
          await storeEncryptedTransaction({
            gcTransaction,
            userId: doc.userId,
            accountId: doc.accountId,
            category: doc.category || undefined,
            databases,
            databaseId: DATABASE_ID,
          });

          stats.migrated++;
          console.log(`✅ Migrated: ${doc.transactionId}`);
        } catch (error: any) {
          stats.failed++;
          console.error(`❌ Failed to migrate ${doc.transactionId}:`, error.message);
        }
      }

      offset += BATCH_SIZE;

      // Delay between batches to avoid rate limits
      if (offset < stats.total) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    stats.endTime = new Date();
    return stats;
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    stats.endTime = new Date();
    return stats;
  }
}

/**
 * Migrate bank accounts
 */
async function migrateBankAccounts(databases: Databases): Promise<MigrationStats> {
  const stats: MigrationStats = {
    collection: 'bank_accounts',
    total: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
  };

  const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string;
  const SOURCE_COLLECTION = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';

  console.log(`\n🔄 Migrating bank accounts from ${SOURCE_COLLECTION}...`);

  try {
    const countResponse = await databases.listDocuments(
      DATABASE_ID,
      SOURCE_COLLECTION,
      [Query.limit(1)]
    );
    stats.total = countResponse.total;

    console.log(`📊 Total accounts to migrate: ${stats.total}`);

    let offset = 0;
    while (offset < stats.total) {
      const batch = await databases.listDocuments(
        DATABASE_ID,
        SOURCE_COLLECTION,
        [Query.limit(BATCH_SIZE), Query.offset(offset)]
      );

      for (const doc of batch.documents) {
        try {
          // Check if already migrated
          const existingEncrypted = await databases.listDocuments(
            DATABASE_ID,
            process.env.APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID || 'bank_accounts_enc',
            [Query.equal('record_id', doc.accountId)]
          );

          if (existingEncrypted.documents.length > 0) {
            stats.skipped++;
            continue;
          }

          // Reconstruct account format
          const gcAccount = doc.raw ? JSON.parse(doc.raw) : {
            iban: doc.iban,
            name: doc.accountName,
            currency: doc.currency,
          };

          await storeEncryptedBankAccount({
            gcAccount,
            userId: doc.userId,
            accountId: doc.accountId,
            institutionId: doc.institutionId,
            institutionName: doc.institutionName,
            databases,
            databaseId: DATABASE_ID,
          });

          stats.migrated++;
          console.log(`✅ Migrated account: ${doc.accountId}`);
        } catch (error: any) {
          stats.failed++;
          console.error(`❌ Failed to migrate ${doc.accountId}:`, error.message);
        }
      }

      offset += BATCH_SIZE;
      if (offset < stats.total) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    stats.endTime = new Date();
    return stats;
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    stats.endTime = new Date();
    return stats;
  }
}

/**
 * Print migration summary
 */
function printSummary(allStats: MigrationStats[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));

  let totalMigrated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const stats of allStats) {
    const duration = stats.endTime
      ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
      : 0;

    console.log(`\n📁 ${stats.collection.toUpperCase()}`);
    console.log(`   Total:    ${stats.total}`);
    console.log(`   Migrated: ${stats.migrated} ✅`);
    console.log(`   Skipped:  ${stats.skipped} ⏭️`);
    console.log(`   Failed:   ${stats.failed} ❌`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);

    totalMigrated += stats.migrated;
    totalFailed += stats.failed;
    totalSkipped += stats.skipped;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Total Migrated: ${totalMigrated}`);
  console.log(`⏭️  Total Skipped:  ${totalSkipped}`);
  console.log(`❌ Total Failed:   ${totalFailed}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const collection = args[0] || 'all';

  console.log('🔐 Encrypted Data Migration Tool');
  console.log('='.repeat(60));

  // Validate environment
  if (!process.env.ENCRYPTION_PROVIDER || !process.env.AWS_KMS_KEY_ARN) {
    console.error('❌ Encryption not configured. Set ENCRYPTION_PROVIDER and AWS_KMS_KEY_ARN');
    process.exit(1);
  }

  console.log(`📝 Migration target: ${collection}`);
  console.log(`🔧 Encryption provider: ${process.env.ENCRYPTION_PROVIDER}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log('='.repeat(60));

  const { databases } = createAppwriteClient();
  const allStats: MigrationStats[] = [];

  try {
    if (collection === 'transactions' || collection === 'all') {
      const stats = await migrateTransactions(databases);
      allStats.push(stats);
    }

    if (collection === 'accounts' || collection === 'all') {
      const stats = await migrateBankAccounts(databases);
      allStats.push(stats);
    }

    // Add more collections as needed
    // if (collection === 'balances' || collection === 'all') { ... }

    printSummary(allStats);

    const totalFailed = allStats.reduce((sum, s) => sum + s.failed, 0);
    if (totalFailed > 0) {
      console.log('⚠️  Some records failed to migrate. Check logs above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
    }
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { migrateTransactions, migrateBankAccounts };
