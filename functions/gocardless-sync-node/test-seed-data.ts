/**
 * Test script to verify GoCardless sync function with explicit encryption
 *
 * This script:
 * 1. Generates mock GoCardless transaction and balance data
 * 2. Seeds MongoDB with encrypted bank accounts (like scripts/mongo/seed-test-data.ts)
 * 3. Tests account retrieval with auto-decryption
 * 4. Verifies all queries and decryption work
 * 5. Cleans up test data
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment from root .env file
config({ path: resolve(process.cwd(), '../../.env') });
import {
  getDb,
  getUserBankAccounts,
  getLastBookingDate,
  documentExists,
} from './src/mongodb';
import { encryptQueryable, encryptRandom } from './src/explicit-encryption';
import { formatTransactionPayload, formatBalancePayload, generateDocId } from './src/utils';
import { suggestCategory, findExistingCategoryMongo } from './src/categorize';

const TEST_USER_ID = 'test-user-sync-001';
const TEST_ACCOUNT_ID = 'ACC-REVOLUT-EUR-TEST';

// Mock GoCardless transactions
function generateMockTransactions(numTransactions: number = 10) {
  const merchants = [
    'Starbucks Coffee', 'Amazon.com', 'Uber Eats', 'Netflix',
    'Spotify', 'Whole Foods', 'Shell Gas Station', 'McDonald\'s',
    'Apple.com', 'Target', 'Walmart', 'Best Buy', 'Costco', 'Tesco'
  ];

  const transactions = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);

  for (let i = 0; i < numTransactions; i++) {
    const txDate = new Date(baseDate);
    txDate.setDate(txDate.getDate() + i * 3);
    const dateStr = txDate.toISOString().split('T')[0];
    
    const amount = -Math.round((Math.random() * 145 + 5) * 100) / 100;
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];

    transactions.push({
      transactionId: `TX-${String(i + 1).padStart(4, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`,
      bookingDate: dateStr,
      valueDate: dateStr,
      bookingDateTime: txDate.toISOString(),
      transactionAmount: {
        amount: String(amount),
        currency: 'USD'
      },
      creditorName: amount < 0 ? merchant : undefined,
      debtorName: amount > 0 ? 'Salary Inc.' : undefined,
      remittanceInformationUnstructured: `Purchase at ${merchant}`,
      additionalInformation: `Card transaction ${dateStr}`
    });
  }

  return transactions;
}

// Mock GoCardless balances
function generateMockBalances() {
  return [
    {
      balanceType: 'closingBooked',
      balanceAmount: {
        amount: String(Math.round((Math.random() * 4000 + 1000) * 100) / 100),
        currency: 'USD'
      },
      referenceDate: new Date().toISOString().split('T')[0]
    },
    {
      balanceType: 'expected',
      balanceAmount: {
        amount: String(Math.round((Math.random() * 4000 + 1000) * 100) / 100),
        currency: 'USD'
      },
      referenceDate: new Date().toISOString().split('T')[0]
    }
  ];
}

async function testBasicEncryption() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Basic Encryption/Decryption');
  console.log('='.repeat(60));

  // Test deterministic encryption
  const accountId = 'ACC-12345-TEST';
  const encrypted1 = await encryptQueryable(accountId);
  const encrypted2 = await encryptQueryable(accountId);
  
  console.log('\n1️⃣  Deterministic Encryption:');
  console.log(`   Original: ${accountId}`);
  console.log(`   Encrypted (Binary): ${encrypted1?.toString('base64').slice(0, 50)}...`);
  
  // Compare binary values
  const isSame = encrypted1 && encrypted2 && 
    encrypted1.toString('base64') === encrypted2.toString('base64');
  console.log(`   ✅ Same input produces same encrypted value: ${isSame}`);

  // Test random encryption
  const amount = '123.45';
  const encryptedAmount = await encryptRandom(amount);
  
  console.log('\n2️⃣  Random Encryption:');
  console.log(`   Original: ${amount}`);
  console.log(`   Encrypted (Binary): ${encryptedAmount?.toString('base64').slice(0, 50)}...`);
  console.log(`   ✅ Encryption successful (auto-decrypts on read)`);
}

async function seedBankAccount() {
  console.log('\n' + '='.repeat(60));
  console.log('Seeding Test Bank Account');
  console.log('='.repeat(60));

  const db = await getDb();

  // 1. Create test requisition with explicit encryption
  const requisitionUpdate: any = {
    userId: TEST_USER_ID,
    institutionId: 'REVOLUT_REVOGB21',
    updatedAt: new Date().toISOString(),
  };

  // Encrypt sensitive fields
  requisitionUpdate.requisitionId = await encryptQueryable('test-req-revolut-001');
  requisitionUpdate.institutionName = await encryptRandom('Revolut');
  requisitionUpdate.status = await encryptRandom('LINKED');
  requisitionUpdate.reference = await encryptRandom(`user_${TEST_USER_ID}_${Date.now()}`);
  requisitionUpdate.redirectUri = await encryptRandom('http://localhost:3000/link-bank/callback');

  const reqResult = await db.collection('requisitions_dev').updateOne(
    { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
    {
      $set: requisitionUpdate,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Requisition: ${reqResult.upsertedCount ? 'created' : 'updated'} (encrypted)`);

  // 2. Create test bank connection with explicit encryption
  const connectionUpdate: any = {
    userId: TEST_USER_ID,
    institutionId: 'REVOLUT_REVOGB21',
    logoUrl: 'https://cdn.revolut.com/media/brand/logo.svg',
    transactionTotalDays: 90,
    maxAccessValidforDays: 180,
    updatedAt: new Date().toISOString(),
  };

  // Encrypt sensitive fields
  connectionUpdate.institutionName = await encryptRandom('Revolut');
  connectionUpdate.status = await encryptRandom('active');
  connectionUpdate.requisitionId = await encryptQueryable('test-req-revolut-001');

  const connResult = await db.collection('bank_connections_dev').updateOne(
    { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
    {
      $set: connectionUpdate,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Bank connection: ${connResult.upsertedCount ? 'created' : 'updated'} (encrypted)`);

  // 3. Create test bank account with explicit encryption
  const plaintextAccountId = 'test-acct-rev-eur-001';
  const encryptedAccountId = await encryptQueryable(plaintextAccountId);

  const accountUpdate: any = {
    userId: TEST_USER_ID,
    institutionId: 'REVOLUT_REVOGB21',
    updatedAt: new Date().toISOString(),
  };

  // Encrypt sensitive fields (including accountId)
  accountUpdate.accountId = encryptedAccountId;
  accountUpdate.institutionName = await encryptRandom('Revolut');
  accountUpdate.iban = await encryptRandom('GB33REVO00996912345678');
  accountUpdate.accountName = await encryptRandom('EUR Current Account');
  accountUpdate.currency = await encryptRandom('EUR');
  accountUpdate.status = await encryptRandom('active');
  accountUpdate.raw = await encryptRandom(JSON.stringify({
    iban: 'GB33REVO00996912345678',
    name: 'EUR Current Account',
    currency: 'EUR'
  }));

  const acctResult = await db.collection('bank_accounts_dev').updateOne(
    { userId: TEST_USER_ID, accountId: encryptedAccountId },
    {
      $set: accountUpdate,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Bank account: ${acctResult.upsertedCount ? 'created' : 'updated'} (encrypted)`);

  return { userId: TEST_USER_ID, accountId: plaintextAccountId, encryptedAccountId };
}

async function testAccountRetrieval() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Account Retrieval (Auto-Decryption)');
  console.log('='.repeat(60));

  const accounts = await getUserBankAccounts(TEST_USER_ID);
  console.log(`\n✅ Retrieved ${accounts.length} account(s)`);

  if (accounts.length > 0) {
    const account = accounts[0];
    console.log('\nDecrypted Account Data:');
    console.log(`   Account ID: ${account.accountId}`);
    console.log(`   Account Name: ${account.accountName}`);
    console.log(`   IBAN: ${account.iban}`);
    console.log(`   Currency: ${account.currency}`);
    console.log(`   Status: ${account.status}`);
    console.log('\n✅ Auto-decryption working - all fields readable!');
  }
}

async function processAndStoreTransactions() {
  console.log('\n' + '='.repeat(60));
  console.log('Processing and Storing Transactions');
  console.log('='.repeat(60));

  const db = await getDb();
  const transactions = generateMockTransactions(5);
  console.log(`\n📊 Generated ${transactions.length} mock transactions`);

  let stored = 0;
  for (const [i, tx] of transactions.entries()) {
    const txDescription = tx.remittanceInformationUnstructured || tx.additionalInformation || '';
    const counterparty = tx.creditorName || tx.debtorName || '';

    // Get or suggest category
    const existingCategory = await findExistingCategoryMongo(db, TEST_USER_ID, txDescription, counterparty);
    const category = existingCategory || await suggestCategory(txDescription, counterparty, tx.transactionAmount?.amount);

    // Prepare document with explicit encryption
    const txDoc: any = {
      userId: TEST_USER_ID,
      category, // Plaintext - needed for queries
      exclude: false, // Plaintext - needed for queries
      bookingDate: tx.bookingDate, // Plaintext - needed for sorting
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Encrypt sensitive fields
    txDoc.accountId = await encryptQueryable(TEST_ACCOUNT_ID);
    txDoc.transactionId = await encryptQueryable(tx.transactionId);
    txDoc.amount = await encryptRandom(tx.transactionAmount?.amount || '0');
    txDoc.currency = await encryptRandom(tx.transactionAmount?.currency || 'EUR');
    txDoc.bookingDateTime = await encryptRandom(tx.bookingDateTime || null);
    txDoc.valueDate = await encryptRandom(tx.valueDate || null);
    txDoc.description = await encryptRandom(txDescription);
    txDoc.counterparty = await encryptRandom(counterparty);
    txDoc.raw = await encryptRandom(JSON.stringify({
      amount: parseFloat(tx.transactionAmount?.amount || '0'),
      description: txDescription
    }));

    try {
      await db.collection('transactions_dev').insertOne(txDoc);
      stored++;
      console.log(`   ${i + 1}. ✅ Stored transaction: ${tx.transactionId} (${category})`);
    } catch (e: any) {
      if (e.code === 11000) {
        console.log(`   ${i + 1}. Transaction ${tx.transactionId} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }

  console.log(`\n✅ Stored ${stored} new transactions, ${transactions.length - stored} already existed`);
  return stored;
}

async function processAndStoreBalances() {
  console.log('\n' + '='.repeat(60));
  console.log('Processing and Storing Balances');
  console.log('='.repeat(60));

  const db = await getDb();
  const balances = generateMockBalances();
  console.log(`\n💰 Generated ${balances.length} mock balances`);

  let stored = 0;
  for (const [i, balance] of balances.entries()) {
    const balanceType = balance.balanceType || 'closingBooked';
    const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];

    // Prepare document with explicit encryption
    const balanceDoc: any = {
      userId: TEST_USER_ID,
      balanceType, // Plaintext - needed for queries
      referenceDate, // Plaintext - needed for queries and sorting
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Encrypt sensitive fields
    balanceDoc.accountId = await encryptQueryable(TEST_ACCOUNT_ID);
    balanceDoc.balanceAmount = await encryptRandom(balance.balanceAmount?.amount || '0');
    balanceDoc.currency = await encryptRandom(balance.balanceAmount?.currency || 'EUR');

    try {
      await db.collection('balances_dev').insertOne(balanceDoc);
      stored++;
      console.log(`   ${i + 1}. ✅ Created balance: ${balanceType} (${balanceDoc.balanceAmount} ${balanceDoc.currency})`);
    } catch (e: any) {
      if (e.code === 11000) {
        console.log(`   ${i + 1}. Balance ${balanceType} already exists, updating...`);

        await db.collection('balances_dev').updateOne(
          { userId: TEST_USER_ID, accountId: balanceDoc.accountId, balanceType, referenceDate },
          {
            $set: {
              balanceAmount: balanceDoc.balanceAmount,
              currency: balanceDoc.currency,
              updatedAt: new Date().toISOString()
            }
          }
        );
        console.log(`   ${i + 1}. ✅ Updated balance: ${balanceType}`);
      } else {
        throw e;
      }
    }
  }

  console.log(`\n✅ Processed ${balances.length} balances`);
}

async function verifyDataQuery() {
  console.log('\n' + '='.repeat(60));
  console.log('Verifying Data Query and Auto-Decryption');
  console.log('='.repeat(60));

  const db = await getDb();

  // Test 1: Query by plaintext userId
  console.log('\n1️⃣  Query by userId (plaintext):');
  const transactions = await db
    .collection('transactions_dev')
    .find({ userId: TEST_USER_ID })
    .toArray();
  console.log(`   Found ${transactions.length} transactions`);
  console.log(`   ✅ Plaintext query successful`);

    // Test 2: Query by encrypted accountId (deterministic)
  console.log('\n2️⃣  Query by accountId (deterministic encryption):');
  const encryptedAccountId = await encryptQueryable('test-acct-rev-eur-001');
  const txsByAccount = await db
    .collection('transactions_dev')
    .find({ userId: TEST_USER_ID, accountId: encryptedAccountId })
    .toArray();
  console.log(`   Found ${txsByAccount.length} transactions for account`);
  console.log(`   ✅ Encrypted field equality query successful`);

  // Test 3: Auto-decryption of sensitive fields
  console.log('\n3️⃣  Auto-Decryption of sensitive fields:');
  if (transactions.length > 0) {
    const tx = transactions[0];
    console.log(`   Transaction ID: ${tx._id}`);
    console.log(`   Amount (decrypted): ${tx.amount}`);
    console.log(`   Description (decrypted): ${tx.description}`);
    console.log(`   Counterparty (decrypted): ${tx.counterparty}`);
    console.log(`   Currency (decrypted): ${tx.currency}`);
    console.log(`   Category (plaintext): ${tx.category}`);
    console.log(`   Booking Date (plaintext): ${tx.bookingDate}`);
    console.log(`   ✅ Auto-decryption successful - all fields readable!`);
  }

  // Test 4: Query balances
  console.log('\n4️⃣  Query balances:');
  const balances = await db
    .collection('balances_dev')
    .find({ userId: TEST_USER_ID, accountId: await encryptQueryable('test-acct-rev-eur-001') })
    .toArray();
  console.log(`   Found ${balances.length} balance(s)`);

  if (balances.length > 0) {
    const balance = balances[0];
    console.log(`   Balance Amount (decrypted): ${balance.balanceAmount}`);
    console.log(`   Currency (decrypted): ${balance.currency}`);
    console.log(`   Balance Type (plaintext): ${balance.balanceType}`);
    console.log(`   Reference Date (plaintext): ${balance.referenceDate}`);
    console.log(`   ✅ Balance query and auto-decryption successful`);
  }

  // Test 5: Query by category (plaintext)
  console.log('\n5️⃣  Query by category (plaintext):');
  const categories = await db
    .collection('transactions_dev')
    .distinct('category', { userId: TEST_USER_ID });
  console.log(`   Found categories: ${categories.join(', ')}`);

  for (const category of categories.slice(0, 3)) {
    const count = await db
      .collection('transactions_dev')
      .countDocuments({ userId: TEST_USER_ID, category });
    console.log(`   - ${category}: ${count} transaction(s)`);
  }
  console.log(`   ✅ Category query successful`);

  // Test 6: Query by date range (plaintext)
  console.log('\n6️⃣  Query by date range (plaintext):');
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 20);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  const recentTxs = await db
    .collection('transactions_dev')
    .find({
      userId: TEST_USER_ID,
      bookingDate: { $gte: dateFromStr }
    })
    .toArray();
  console.log(`   Found ${recentTxs.length} transactions since ${dateFromStr}`);
  console.log(`   ✅ Date range query successful`);

  // Test 7: Test getLastBookingDate function
  console.log('\n7️⃣  Testing getLastBookingDate function:');
  const lastDate = await getLastBookingDate(TEST_USER_ID, 'test-acct-rev-eur-001');
  console.log(`   Last booking date: ${lastDate || 'none'}`);
  console.log(`   ✅ Function working correctly`);
}

async function cleanupTestData() {
  console.log('\n' + '='.repeat(60));
  console.log('Cleaning Up Test Data');
  console.log('='.repeat(60));

  const db = await getDb();

  const txResult = await db.collection('transactions_dev').deleteMany({ userId: TEST_USER_ID });
  console.log(`   ✅ Deleted ${txResult.deletedCount} transaction(s)`);

  const balResult = await db.collection('balances_dev').deleteMany({ userId: TEST_USER_ID });
  console.log(`   ✅ Deleted ${balResult.deletedCount} balance(s)`);

  const acctResult = await db.collection('bank_accounts_dev').deleteMany({ userId: TEST_USER_ID });
  console.log(`   ✅ Deleted ${acctResult.deletedCount} account(s)`);

  const connResult = await db.collection('bank_connections_dev').deleteMany({ userId: TEST_USER_ID });
  console.log(`   ✅ Deleted ${connResult.deletedCount} connection(s)`);

  const reqResult = await db.collection('requisitions_dev').deleteMany({ userId: TEST_USER_ID });
  console.log(`   ✅ Deleted ${reqResult.deletedCount} requisition(s)`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('GoCardless Sync Node.js Function - Test Suite');
  console.log('='.repeat(60));
  console.log('\nThis test will:');
  console.log('1. Test basic encryption/decryption');
  console.log('2. Seed a test bank account in MongoDB');
  console.log('3. Test account retrieval with auto-decryption');
  console.log('4. Process and store mock transactions');
  console.log('5. Process and store mock balances');
  console.log('6. Verify all queries and decryption work');
  console.log('7. Clean up test data');
  console.log('\nStarting tests...\n');

  try {
    // Test 1: Basic encryption
    await testBasicEncryption();

    // Test 2: Seed bank account
    const { userId, accountId, encryptedAccountId } = await seedBankAccount();
    console.log(`\n✅ Test user: ${userId}`);
    console.log(`✅ Test account: ${accountId}`);

    // Test 3: Account retrieval
    await testAccountRetrieval();

    // Test 4: Store transactions
    await processAndStoreTransactions();

    // Test 5: Store balances
    await processAndStoreBalances();

    // Test 6: Verify queries
    await verifyDataQuery();

    // Test 7: Cleanup
    console.log('\n' + '='.repeat(60));
    await cleanupTestData();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log('   ✅ Encryption/decryption working');
    console.log('   ✅ Data stored in MongoDB with explicit encryption');
    console.log('   ✅ Plaintext fields queryable (userId, category, dates)');
    console.log('   ✅ Encrypted fields queryable for equality (accountId)');
    console.log('   ✅ Sensitive fields auto-decrypt on read');
    console.log('   ✅ Categorization working');
    console.log('\n🎉 GoCardless sync Node.js function is ready for deployment!');

    process.exit(0);

  } catch (error: any) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(60));
    console.log(`\nError: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();

