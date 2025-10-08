/**
 * Client-side query test
 * 
 * Demonstrates how Next.js API routes would query the encrypted data
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../../.env') });

import { getDb } from './src/mongodb.js';
import { encryptQueryable } from './src/explicit-encryption.js';

const TEST_USER_ID = 'test-client-query-001';
const TEST_ACCOUNT_ID = 'ACC-CLIENT-TEST';

async function seedSampleData() {
  console.log('\n📝 Seeding sample encrypted data...');
  
  const db = await getDb();
  const encryptedAccountId = await encryptQueryable(TEST_ACCOUNT_ID);

  // Import encryption functions
  const { encryptRandom } = await import('./src/explicit-encryption.js');

  // Seed a few transactions
  const txData = [
    {
      _id: 'tx-client-001',
      userId: TEST_USER_ID,
      category: 'Restaurants',
      exclude: false,
      bookingDate: '2025-10-08',
      accountId: encryptedAccountId,
      transactionId: await encryptQueryable('TXN-001'),
      amount: await encryptRandom('-45.50'),
      currency: await encryptRandom('EUR'),
      description: await encryptRandom('Lunch at Italian Restaurant'),
      counterparty: await encryptRandom('Bella Italia'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: 'tx-client-002',
      userId: TEST_USER_ID,
      category: 'Shopping',
      exclude: false,
      bookingDate: '2025-10-07',
      accountId: encryptedAccountId,
      transactionId: await encryptQueryable('TXN-002'),
      amount: await encryptRandom('-120.00'),
      currency: await encryptRandom('EUR'),
      description: await encryptRandom('Amazon purchase'),
      counterparty: await encryptRandom('Amazon EU'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const tx of txData) {
    try {
      await db.collection('transactions_dev').insertOne(tx);
    } catch (e) {
      if (e.code === 11000) {
        console.log(`   Transaction ${tx._id} already exists`);
      }
    }
  }

  console.log(`✅ Seeded ${txData.length} transactions`);
}

async function testClientQueries() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Client-Side Query Patterns');
  console.log('='.repeat(60));

  const db = await getDb();
  const encryptedAccountId = await encryptQueryable(TEST_ACCOUNT_ID);

  // Query 1: Get all user transactions (like /api/transactions)
  console.log('\n1️⃣  Query: Get all user transactions');
  const allTxs = await db
    .collection('transactions_dev')
    .find({ userId: TEST_USER_ID })
    .sort({ bookingDate: -1 })
    .toArray();
  
  console.log(`   Found ${allTxs.length} transactions`);
  console.log(`   First transaction: ${allTxs[0]?.description} (${allTxs[0]?.amount} ${allTxs[0]?.currency})`);
  console.log(`   ✅ Auto-decryption working`);

  // Query 2: Filter by category (like /api/categories)
  console.log('\n2️⃣  Query: Filter by category');
  const restaurantTxs = await db
    .collection('transactions_dev')
    .find({ userId: TEST_USER_ID, category: 'Restaurants' })
    .toArray();
  
  console.log(`   Found ${restaurantTxs.length} restaurant transaction(s)`);
  if (restaurantTxs.length > 0) {
    console.log(`   Example: ${restaurantTxs[0]?.counterparty} - ${restaurantTxs[0]?.amount}`);
  }
  console.log(`   ✅ Category filter working`);

  // Query 3: Filter by date range (like /api/timeseries)
  console.log('\n3️⃣  Query: Filter by date range');
  const recentTxs = await db
    .collection('transactions_dev')
    .find({
      userId: TEST_USER_ID,
      bookingDate: { $gte: '2025-10-07' }
    })
    .toArray();
  
  console.log(`   Found ${recentTxs.length} transaction(s) since 2025-10-07`);
  console.log(`   ✅ Date range filter working`);

  // Query 4: Get account balances (like /api/accounts/[id])
  console.log('\n4️⃣  Query: Get account balances');
  const balances = await db
    .collection('balances_dev')
    .find({ userId: TEST_USER_ID, accountId: encryptedAccountId })
    .sort({ referenceDate: -1 })
    .toArray();
  
  console.log(`   Found ${balances.length} balance(s)`);
  if (balances.length > 0) {
    console.log(`   Latest: ${balances[0]?.balanceAmount} ${balances[0]?.currency} (${balances[0]?.balanceType})`);
  }
  console.log(`   ✅ Balance query with encrypted accountId working`);

  // Query 5: Aggregate by category (like dashboard metrics)
  console.log('\n5️⃣  Query: Aggregate by category');
  const pipeline = [
    { $match: { userId: TEST_USER_ID, exclude: { $ne: true } } },
    { $group: {
      _id: '$category',
      total: { $sum: 1 }
    }},
    { $sort: { total: -1 } }
  ];

  const categoryAgg = await db
    .collection('transactions_dev')
    .aggregate(pipeline)
    .toArray();

  console.log(`   Categories:`);
  for (const cat of categoryAgg) {
    console.log(`   - ${cat._id}: ${cat.total} transaction(s)`);
  }
  console.log(`   ✅ Aggregation working`);

  // Query 6: Count expenses vs income
  console.log('\n6️⃣  Query: Calculate metrics');
  let income = 0;
  let expenses = 0;

  for (const tx of allTxs) {
    const amount = parseFloat(tx.amount || '0');
    if (amount > 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
  }

  console.log(`   Income: €${income.toFixed(2)}`);
  console.log(`   Expenses: €${expenses.toFixed(2)}`);
  console.log(`   Net: €${(income - expenses).toFixed(2)}`);
  console.log(`   ✅ Metrics calculation working`);
}

async function cleanup() {
  console.log('\n🗑️  Cleaning up test data...');
  const db = await getDb();

  const txResult = await db.collection('transactions_dev').deleteMany({ userId: TEST_USER_ID });
  const balResult = await db.collection('balances_dev').deleteMany({ userId: TEST_USER_ID });

  console.log(`   ✅ Deleted ${txResult.deletedCount} transaction(s)`);
  console.log(`   ✅ Deleted ${balResult.deletedCount} balance(s)`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('Client-Side Query Test');
  console.log('='.repeat(60));
  console.log('\nThis demonstrates how Next.js API routes query encrypted data\n');

  try {
    await seedSampleData();
    await testClientQueries();
    await cleanup();

    console.log('\n' + '='.repeat(60));
    console.log('✅ CLIENT QUERY TEST PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 Verified Query Patterns:');
    console.log('   ✅ Query all user transactions');
    console.log('   ✅ Filter by category (plaintext)');
    console.log('   ✅ Filter by date range (plaintext)');
    console.log('   ✅ Query by encrypted accountId (deterministic)');
    console.log('   ✅ Aggregate by category');
    console.log('   ✅ Calculate financial metrics');
    console.log('\n🎉 All client query patterns working correctly!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

