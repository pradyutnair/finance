/**
 * Seed test data and LEAVE IT in MongoDB for inspection
 * This does NOT cleanup - you can verify the data in MongoDB Atlas
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

import { getDb } from './src/mongodb.js';
import { encryptQueryable, encryptRandom } from './src/explicit-encryption.js';
import { formatTransactionPayload, formatBalancePayload, generateDocId } from './src/utils.js';

const TEST_USER_ID = '68d446e7bf3ed043310a'; // Real user ID from your DB
const TEST_ACCOUNT_ID = 'ACC-PERSISTENT-TEST-001';

async function main() {
  console.log('\n🌱 Seeding PERSISTENT test data (will NOT cleanup)...\n');

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    console.log('✅ MongoDB connected\n');

    // 1. Create bank connection
    console.log('1️⃣  Creating bank connection...');
    const encryptedAccountId = await encryptQueryable(TEST_ACCOUNT_ID);
    
    const connectionDoc = {
      userId: TEST_USER_ID,
      institutionId: 'REVOLUT_REVOGB21',
      institutionName: await encryptRandom('Revolut Test Bank'),
      status: await encryptRandom('active'),
      requisitionId: await encryptQueryable('req-persistent-001'),
      logoUrl: 'https://cdn.revolut.com/logo.svg',
      transactionTotalDays: 90,
      maxAccessValidforDays: 180,
    };

    await db.collection('bank_connections_dev').updateOne(
      { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
      { $set: connectionDoc, $setOnInsert: { createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log('   ✅ Bank connection created/updated\n');

    // 2. Create bank account
    console.log('2️⃣  Creating bank account...');
    const accountDoc = {
      userId: TEST_USER_ID,
      institutionId: 'REVOLUT_REVOGB21',
      accountId: encryptedAccountId,
      institutionName: await encryptRandom('Revolut Test Bank'),
      iban: await encryptRandom('GB29NWBK60161331926819'),
      accountName: await encryptRandom('Test EUR Account'),
      currency: await encryptRandom('EUR'),
      status: await encryptRandom('active'),
      raw: await encryptRandom(JSON.stringify({
        iban: 'GB29NWBK60161331926819',
        name: 'Test EUR Account',
        currency: 'EUR'
      })),
    };

    await db.collection('bank_accounts_dev').updateOne(
      { userId: TEST_USER_ID, accountId: encryptedAccountId },
      { $set: accountDoc, $setOnInsert: { createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log('   ✅ Bank account created/updated\n');

    // 3. Create requisition
    console.log('3️⃣  Creating requisition...');
    const requisitionDoc = {
      userId: TEST_USER_ID,
      institutionId: 'REVOLUT_REVOGB21',
      requisitionId: await encryptQueryable('req-persistent-001'),
      status: await encryptRandom('LINKED'),
      reference: await encryptRandom(`user_${TEST_USER_ID}_${Date.now()}`),
      redirectUri: await encryptRandom('http://localhost:3000/link-bank/callback'),
      institutionName: await encryptRandom('Revolut Test Bank'),
    };

    await db.collection('requisitions_dev').updateOne(
      { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
      { $set: requisitionDoc, $setOnInsert: { createdAt: new Date().toISOString() } },
      { upsert: true }
    );
    console.log('   ✅ Requisition created/updated\n');

    // 4. Create transactions
    console.log('4️⃣  Creating transactions...');
    const mockTransactions = [
      {
        txId: 'TX-PERSIST-STARBUCKS-001',
        amount: '-5.50',
        date: '2025-10-08',
        description: 'Starbucks Coffee London',
        counterparty: 'Starbucks',
        category: 'Restaurants'
      },
      {
        txId: 'TX-PERSIST-AMAZON-001',
        amount: '-89.99',
        date: '2025-10-07',
        description: 'Amazon.com ORDER #12345',
        counterparty: 'Amazon EU S.a.r.L',
        category: 'Shopping'
      },
      {
        txId: 'TX-PERSIST-TESCO-001',
        amount: '-67.30',
        date: '2025-10-06',
        description: 'TESCO STORES 2456',
        counterparty: 'Tesco',
        category: 'Groceries'
      },
      {
        txId: 'TX-PERSIST-SALARY-001',
        amount: '3500.00',
        date: '2025-10-05',
        description: 'SALARY PAYMENT OCTOBER',
        counterparty: 'ACME Corporation Ltd',
        category: 'Income'
      },
      {
        txId: 'TX-PERSIST-NETFLIX-001',
        amount: '-15.99',
        date: '2025-10-04',
        description: 'Netflix Subscription',
        counterparty: 'Netflix International B.V.',
        category: 'Entertainment'
      }
    ];

    let txCreated = 0;
    let txUpdated = 0;

    for (const mockTx of mockTransactions) {
      const txDoc = {
        _id: mockTx.txId,
        userId: TEST_USER_ID,
        category: mockTx.category,
        exclude: false,
        bookingDate: mockTx.date,
        accountId: encryptedAccountId,
        transactionId: await encryptQueryable(mockTx.txId),
        amount: await encryptRandom(mockTx.amount),
        currency: await encryptRandom('EUR'),
        valueDate: await encryptRandom(mockTx.date),
        description: await encryptRandom(mockTx.description),
        counterparty: await encryptRandom(mockTx.counterparty),
        raw: await encryptRandom(JSON.stringify({ amount: mockTx.amount, description: mockTx.description })),
        
      };

      try {
        await db.collection('transactions_dev').insertOne(txDoc);
        txCreated++;
        console.log(`   ✅ Created: ${mockTx.txId} - ${mockTx.category} (${mockTx.amount} EUR)`);
      } catch (e) {
        if (e.code === 11000) {
          await db.collection('transactions_dev').updateOne(
            { _id: mockTx.txId },
            { $set: txDoc }
          );
          txUpdated++;
          console.log(`   🔄 Updated: ${mockTx.txId} - ${mockTx.category}`);
        } else {
          throw e;
        }
      }
    }
    console.log(`\n   📊 Transactions: ${txCreated} created, ${txUpdated} updated\n`);

    // 5. Create balances
    console.log('5️⃣  Creating balances...');
    const balances = [
      { type: 'closingBooked', amount: '4523.67', date: '2025-10-08' },
      { type: 'expected', amount: '4523.67', date: '2025-10-08' },
      { type: 'interimAvailable', amount: '4538.66', date: '2025-10-08' }
    ];

    let balCreated = 0;
    let balUpdated = 0;

    for (const bal of balances) {
      const balDoc = {
        _id: `${TEST_ACCOUNT_ID}_${bal.type}`,
        userId: TEST_USER_ID,
        balanceType: bal.type,
        referenceDate: bal.date,
        accountId: encryptedAccountId,
        balanceAmount: await encryptRandom(bal.amount),
        currency: await encryptRandom('EUR'),
        
      };

      try {
        await db.collection('balances_dev').insertOne(balDoc);
        balCreated++;
        console.log(`   ✅ Created: ${bal.type} - ${bal.amount} EUR`);
      } catch (e) {
        if (e.code === 11000) {
          await db.collection('balances_dev').updateOne(
            { _id: balDoc._id },
            { $set: balDoc }
          );
          balUpdated++;
          console.log(`   🔄 Updated: ${bal.type} - ${bal.amount} EUR`);
        } else {
          throw e;
        }
      }
    }
    console.log(`\n   📊 Balances: ${balCreated} created, ${balUpdated} updated\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('✅ DATA SEEDED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   User ID: ${TEST_USER_ID}`);
    console.log(`   Account ID: ${TEST_ACCOUNT_ID}`);
    console.log(`   Requisitions: 1`);
    console.log(`   Bank Connections: 1`);
    console.log(`   Bank Accounts: 1`);
    console.log(`   Transactions: ${mockTransactions.length}`);
    console.log(`   Balances: ${balances.length}`);
    console.log('\n🔍 Check MongoDB Atlas now:');
    console.log(`   - Collection: requisitions_dev (filter: userId="${TEST_USER_ID}")`);
    console.log(`   - Collection: bank_connections_dev (filter: userId="${TEST_USER_ID}")`);
    console.log(`   - Collection: bank_accounts_dev (filter: userId="${TEST_USER_ID}")`);
    console.log(`   - Collection: transactions_dev (filter: userId="${TEST_USER_ID}")`);
    console.log(`   - Collection: balances_dev (filter: userId="${TEST_USER_ID}")`);
    console.log('\n🔐 Note: Sensitive fields are encrypted (Binary), plaintext fields are readable');
    console.log('\n⚠️  Data will remain in database until you run: npm run cleanup');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

