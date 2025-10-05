import 'dotenv/config';
import { getDb } from '../../lib/mongo/client';

const TEST_USER_ID = '68d446e7bf3ed043310a';

async function seedTestData() {
  const db = await getDb();
  
  console.log(`🌱 Seeding test data for user ${TEST_USER_ID}...`);
  
  // 1. Create test requisition
  const reqResult = await db.collection('requisitions_dev').updateOne(
    { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
    {
      $set: {
        userId: TEST_USER_ID,
        requisitionId: 'test-req-revolut-001',
        institutionId: 'REVOLUT_REVOGB21',
        institutionName: 'Revolut',
        status: 'LINKED',
        reference: `user_${TEST_USER_ID}_${Date.now()}`,
        redirectUri: 'http://localhost:3000/link-bank/callback',
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Requisition: ${reqResult.upsertedCount ? 'created' : 'updated'}`);
  
  // 2. Create test bank connection
  const connResult = await db.collection('bank_connections_dev').updateOne(
    { userId: TEST_USER_ID, institutionId: 'REVOLUT_REVOGB21' },
    {
      $set: {
        userId: TEST_USER_ID,
        institutionId: 'REVOLUT_REVOGB21',
        institutionName: 'Revolut',
        status: 'active',
        requisitionId: 'test-req-revolut-001',
        logoUrl: 'https://cdn.revolut.com/media/brand/logo.svg',
        transactionTotalDays: 90,
        maxAccessValidforDays: 180,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Bank connection: ${connResult.upsertedCount ? 'created' : 'updated'}`);
  
  // 3. Create test bank account (sensitive fields auto-encrypted)
  const acctResult = await db.collection('bank_accounts_dev').updateOne(
    { userId: TEST_USER_ID, accountId: 'test-acct-rev-eur-001' },
    {
      $set: {
        userId: TEST_USER_ID,
        accountId: 'test-acct-rev-eur-001',
        institutionId: 'REVOLUT_REVOGB21',
        institutionName: 'Revolut',
        iban: 'GB33REVO00996912345678',
        accountName: 'EUR Current Account',
        currency: 'EUR',
        status: 'active',
        raw: JSON.stringify({ 
          iban: 'GB33REVO00996912345678', 
          name: 'EUR Current Account',
          currency: 'EUR'
        }),
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Bank account: ${acctResult.upsertedCount ? 'created' : 'updated'}`);
  
  // 4. Create test balances
  const today = new Date().toISOString().split('T')[0];
  const balResult = await db.collection('balances_dev').updateOne(
    { 
      userId: TEST_USER_ID, 
      accountId: 'test-acct-rev-eur-001',
      balanceType: 'interimAvailable',
      referenceDate: today
    },
    {
      $set: {
        userId: TEST_USER_ID,
        accountId: 'test-acct-rev-eur-001',
        balanceAmount: '5420.50',
        currency: 'EUR',
        balanceType: 'interimAvailable',
        referenceDate: today,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
  console.log(`✅ Balance: ${balResult.upsertedCount ? 'created' : 'updated'}`);
  
  // 5. Create test transactions
  // NOTE: In production, these come from GoCardless as plaintext,
  // get categorized via suggestCategory(), then encrypted on insert
  const transactions = [
    {
      transactionId: 'tx-tesco-001',
      amount: '-45.80',
      bookingDate: '2025-10-04',
      description: 'TESCO SUPERMARKET LONDON',
      counterparty: 'Tesco Stores Ltd',
      category: 'Groceries',
    },
    {
      transactionId: 'tx-starbucks-001',
      amount: '-12.50',
      bookingDate: '2025-10-03',
      description: 'STARBUCKS COFFEE',
      counterparty: 'Starbucks Coffee Company',
      category: 'Restaurants',
    },
    {
      transactionId: 'tx-shell-001',
      amount: '-85.00',
      bookingDate: '2025-10-02',
      description: 'SHELL FUEL STATION',
      counterparty: 'Shell UK Ltd',
      category: 'Transport',
    },
    {
      transactionId: 'tx-uber-001',
      amount: '-18.90',
      bookingDate: '2025-10-01',
      description: 'UBER TRIP',
      counterparty: 'Uber Technologies',
      category: 'Transport',
    },
    {
      transactionId: 'tx-salary-001',
      amount: '2500.00',
      bookingDate: '2025-10-01',
      description: 'SALARY PAYMENT - OCTOBER',
      counterparty: 'ACME Corporation Ltd',
      category: 'Income',
    },
    {
      transactionId: 'tx-amazon-001',
      amount: '-67.99',
      bookingDate: '2025-09-30',
      description: 'AMAZON.CO.UK PURCHASE',
      counterparty: 'Amazon EU S.a.r.L',
      category: 'Shopping',
    },
    {
      transactionId: 'tx-netflix-001',
      amount: '-15.99',
      bookingDate: '2025-09-28',
      description: 'NETFLIX SUBSCRIPTION',
      counterparty: 'Netflix International',
      category: 'Entertainment',
    },
    {
      transactionId: 'tx-gym-001',
      amount: '-45.00',
      bookingDate: '2025-09-25',
      description: 'PURE GYM MEMBERSHIP',
      counterparty: 'PureGym Ltd',
      category: 'Health',
    },
  ];
  
  let txCount = 0;
  for (const tx of transactions) {
    try {
      await db.collection('transactions_dev').insertOne({
        userId: TEST_USER_ID,
        accountId: 'test-acct-rev-eur-001',
        transactionId: tx.transactionId,
        amount: tx.amount,
        currency: 'EUR',
        bookingDate: tx.bookingDate,
        bookingDateTime: `${tx.bookingDate}T${10 + txCount}:30:00Z`,
        valueDate: tx.bookingDate,
        description: tx.description,
        counterparty: tx.counterparty,
        category: tx.category,
        exclude: false,
        raw: JSON.stringify({ 
          amount: parseFloat(tx.amount),
          description: tx.description
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      txCount++;
    } catch (e: any) {
      if (e.code === 11000) {
        console.log(`   Transaction ${tx.transactionId} already exists, skipping`);
      } else {
        throw e;
      }
    }
  }
  console.log(`✅ Transactions: ${txCount} created, ${transactions.length - txCount} skipped`);
  
  console.log('\n✅ Test data seeded successfully!');
  console.log(`\nUser ID: ${TEST_USER_ID}`);
  console.log(`- 1 bank connection (Revolut)`);
  console.log(`- 1 bank account`);
  console.log(`- 1 balance record`);
  console.log(`- ${transactions.length} transactions`);
  console.log(`\nNote: Sensitive fields (iban, accountName, amounts, descriptions) are automatically encrypted.`);
  
  process.exit(0);
}

seedTestData().catch((e) => {
  console.error('❌ Seeding failed:', e);
  process.exit(1);
});

