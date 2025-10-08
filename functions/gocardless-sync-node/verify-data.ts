/**
 * Verify what data exists in MongoDB and show decrypted values
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

import { getDb } from './src/mongodb.js';
import { encryptQueryable } from './src/explicit-encryption.js';

const TEST_USER_ID = '68d446e7bf3ed043310a';

async function main() {
  console.log('\n🔍 Verifying data in MongoDB...\n');

  try {
    const db = await getDb();

    // Check requisitions
    console.log('1️⃣  Requisitions:');
    const requisitions = await db.collection('requisitions_dev')
      .find({ userId: TEST_USER_ID })
      .toArray();
    console.log(`   Found: ${requisitions.length} requisition(s)`);
    if (requisitions.length > 0) {
      const req = requisitions[0];
      console.log(`   - Institution: ${req.institutionName} (decrypted)`);
      console.log(`   - Status: ${req.status} (decrypted)`);
      console.log(`   - Created: ${req.createdAt}`);
    }

    // Check bank connections
    console.log('\n2️⃣  Bank Connections:');
    const connections = await db.collection('bank_connections_dev')
      .find({ userId: TEST_USER_ID })
      .toArray();
    console.log(`   Found: ${connections.length} connection(s)`);
    if (connections.length > 0) {
      const conn = connections[0];
      console.log(`   - Institution: ${conn.institutionName} (decrypted)`);
      console.log(`   - Status: ${conn.status} (decrypted)`);
      console.log(`   - Logo: ${conn.logoUrl} (plaintext)`);
    }

    // Check bank accounts
    console.log('\n3️⃣  Bank Accounts:');
    const accounts = await db.collection('bank_accounts_dev')
      .find({ userId: TEST_USER_ID })
      .toArray();
    console.log(`   Found: ${accounts.length} account(s)`);
    if (accounts.length > 0) {
      const acct = accounts[0];
      console.log(`   - Account ID: ${acct.accountId} (decrypted)`);
      console.log(`   - Account Name: ${acct.accountName} (decrypted)`);
      console.log(`   - IBAN: ${acct.iban} (decrypted)`);
      console.log(`   - Currency: ${acct.currency} (decrypted)`);
      console.log(`   - Status: ${acct.status} (decrypted)`);
    }

    // Check transactions
    console.log('\n4️⃣  Transactions:');
    const transactions = await db.collection('transactions_dev')
      .find({ userId: TEST_USER_ID })
      .sort({ bookingDate: -1 })
      .toArray();
    console.log(`   Found: ${transactions.length} transaction(s)`);
    
    if (transactions.length > 0) {
      console.log('\n   Recent transactions:');
      for (const tx of transactions.slice(0, 5)) {
        console.log(`   - ${tx.bookingDate}: ${tx.counterparty} - ${tx.amount} ${tx.currency} (${tx.category})`);
        console.log(`     Description: ${tx.description}`);
      }
    }

    // Check balances
    console.log('\n5️⃣  Balances:');
    const balances = await db.collection('balances_dev')
      .find({ userId: TEST_USER_ID })
      .toArray();
    console.log(`   Found: ${balances.length} balance(s)`);
    
    if (balances.length > 0) {
      for (const bal of balances) {
        console.log(`   - ${bal.balanceType}: ${bal.balanceAmount} ${bal.currency} (${bal.referenceDate})`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Data Summary');
    console.log('='.repeat(60));
    console.log(`User ID: ${TEST_USER_ID}`);
    console.log(`Requisitions: ${requisitions.length}`);
    console.log(`Bank Connections: ${connections.length}`);
    console.log(`Bank Accounts: ${accounts.length}`);
    console.log(`Transactions: ${transactions.length}`);
    console.log(`Balances: ${balances.length}`);
    
    if (transactions.length === 0 && balances.length === 0 && accounts.length === 0) {
      console.log('\n⚠️  No data found! Run: npm run seed');
    } else {
      console.log('\n✅ All data values shown above are DECRYPTED automatically');
      console.log('🔐 In MongoDB, sensitive fields are stored as Binary (encrypted)');
    }

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

