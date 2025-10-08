import 'dotenv/config';
import { getDb } from '../../lib/mongo/client';
import { 
  encryptQueryable, 
  encryptRandom 
} from '../../lib/mongo/explicit-encryption';

const TEST_USER_ID = '68d446e7bf3ed043310a';

async function seedTestData() {
  const db = await getDb();
  
  console.log(`🌱 Seeding test data for user ${TEST_USER_ID} with explicit encryption...`);
  
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
  
  // 4. Create test balances with explicit encryption
  const today = new Date().toISOString().split('T')[0];
  const balanceUpdate: any = {
    userId: TEST_USER_ID,
    balanceType: 'interimAvailable',
    referenceDate: today,
    updatedAt: new Date().toISOString(),
  };
  
  // Encrypt sensitive fields (including accountId)
  balanceUpdate.accountId = encryptedAccountId;
  balanceUpdate.balanceAmount = await encryptRandom('5420.50');
  balanceUpdate.currency = await encryptRandom('EUR');
  
  const balResult = await db.collection('balances_dev').updateOne(
    { 
      userId: TEST_USER_ID, 
      accountId: encryptedAccountId,
      balanceType: 'interimAvailable',
      referenceDate: today
    },
    {
      $set: balanceUpdate,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Balance: ${balResult.upsertedCount ? 'created' : 'updated'} (encrypted)`);
  
  // 5. Create test transactions with explicit encryption
  const transactions = [
    {
      transactionId: 'tx-costco-001',
      amount: '-45.80',
      bookingDate: '2025-10-08',
      description: 'COSTCO SUPERMARKET LONDON',
      counterparty: 'Costco Stores Ltd',
      category: 'Groceries',
    },
    {
      transactionId: 'tx-roaster-001',
      amount: '-12.50',
      bookingDate: '2025-10-08',
      description: 'Roaster Coffee Company',
      counterparty: 'Roaster Coffee Company',
      category: 'Restaurants',
    },
    {
      transactionId: 'tx-mietheater-001',
      amount: '-85.00',
      bookingDate: '2025-10-07',
      description: 'Mietheater',
      counterparty: 'Mietheater',
      category: 'Entertainment',
    },
    {
      transactionId: 'tx-tomtom-001',
      amount: '2500.00',
      bookingDate: '2025-10-07',
      description: 'SALARY PAYMENT - OCTOBER',
      counterparty: 'Tom Tom Ltd',
      category: 'Income',
    },
  ];
  
  let txCount = 0;
  for (const tx of transactions) {
    try {
      // Prepare document with explicit encryption
      const txDoc: any = {
        userId: TEST_USER_ID,
        category: tx.category, // Plaintext - needed for queries
        exclude: false, // Plaintext - needed for queries
        bookingDate: tx.bookingDate, // Plaintext - needed for sorting
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Encrypt sensitive fields (including accountId)
      txDoc.accountId = encryptedAccountId;
      txDoc.transactionId = await encryptQueryable(tx.transactionId);
      txDoc.amount = await encryptRandom(tx.amount);
      txDoc.currency = await encryptRandom('EUR');
      txDoc.bookingDateTime = await encryptRandom(`${tx.bookingDate}T${10 + txCount}:30:00Z`);
      txDoc.valueDate = await encryptRandom(tx.bookingDate);
      txDoc.description = await encryptRandom(tx.description);
      txDoc.counterparty = await encryptRandom(tx.counterparty);
      txDoc.raw = await encryptRandom(JSON.stringify({ 
        amount: parseFloat(tx.amount),
        description: tx.description
      }));
      
      await db.collection('transactions_dev').insertOne(txDoc);
      txCount++;
    } catch (e: any) {
      if (e.code === 11000) {
        console.log(`   Transaction ${tx.transactionId} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }
  console.log(`✅ Transactions: ${txCount} created, ${transactions.length - txCount} skipped (encrypted)`);
  
  console.log('\n🎉 Test data seeded successfully with explicit encryption!');
  console.log(`\nUser ID: ${TEST_USER_ID}`);
  console.log(`- 1 bank connection (Revolut)`);
  console.log(`- 1 bank account`);
  console.log(`- 1 balance record`);
  console.log(`- ${transactions.length} transactions`);
  console.log(`\n🔐 All sensitive fields are explicitly encrypted before storage.`);
  console.log(`📖 Data will be automatically decrypted when read.`);
  
  process.exit(0);
}

seedTestData().catch((e) => {
  console.error('❌ Seeding failed:', e);
  process.exit(1);
});

