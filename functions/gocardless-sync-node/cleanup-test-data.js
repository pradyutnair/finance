/**
 * Cleanup test data from MongoDB
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

import { getDb } from './src/mongodb.js';

const TEST_USER_ID = '68d446e7bf3ed043310a';

async function main() {
  console.log('\n🗑️  Cleaning up test data from MongoDB...\n');

  try {
    const db = await getDb();

    const txResult = await db.collection('transactions_dev').deleteMany({ userId: TEST_USER_ID });
    console.log(`✅ Deleted ${txResult.deletedCount} transaction(s)`);

    const balResult = await db.collection('balances_dev').deleteMany({ userId: TEST_USER_ID });
    console.log(`✅ Deleted ${balResult.deletedCount} balance(s)`);

    const acctResult = await db.collection('bank_accounts_dev').deleteMany({ userId: TEST_USER_ID });
    console.log(`✅ Deleted ${acctResult.deletedCount} account(s)`);

    const connResult = await db.collection('bank_connections_dev').deleteMany({ userId: TEST_USER_ID });
    console.log(`✅ Deleted ${connResult.deletedCount} connection(s)`);

    const reqResult = await db.collection('requisitions_dev').deleteMany({ userId: TEST_USER_ID });
    console.log(`✅ Deleted ${reqResult.deletedCount} requisition(s)`);

    console.log('\n✅ Cleanup complete!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

main();

