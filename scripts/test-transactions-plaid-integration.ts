import { getDb } from '../lib/mongo/client';
import { toPlaidTransactionRecord } from '../lib/plaid/transactions-plaid';
import { encryptPlaidTransactionFields } from '../lib/mongo/explicit-encryption';

// Sample Plaid transaction data
const samplePlaidTransaction = {
  transaction_id: 'test_tx_123456789',
  account_id: 'test_acc_123',
  amount: -25.50,
  iso_currency_code: 'USD',
  date: '2024-11-04',
  name: 'Starbucks Coffee',
  merchant_name: 'Starbucks',
  original_description: 'STARBUCKS COFFEE',
  category: ['Food and Drink', 'Restaurants'],
  personal_finance_category: {
    primary: 'Food and Drink',
    detailed: 'Restaurants',
    confidence_level: 'HIGH'
  },
  pending: false,
  payment_channel: 'in store',
  location: {
    address: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    postal_code: '94105',
    country: 'US'
  }
};

async function testTransactionsPlaidIntegration() {
  console.log('🧪 Testing transactions_plaid integration...');

  try {
    const db = await getDb();
    const coll = db.collection('transactions_plaid');

    // Test 1: Convert Plaid transaction to record
    console.log('✅ Testing Plaid transaction conversion...');
    const testUserId = 'test-user-123';
    const testAccountId = 'test-account-123';

    const transactionRecord = toPlaidTransactionRecord(
      samplePlaidTransaction,
      testUserId,
      testAccountId
    );

    console.log('Converted transaction:', {
      transactionId: transactionRecord.transactionId,
      amount: transactionRecord.amount,
      currency: transactionRecord.currency,
      bookingDate: transactionRecord.bookingDate,
      description: transactionRecord.description,
      counterparty: transactionRecord.counterparty,
      category: transactionRecord.category
    });

    // Test 2: Encrypt transaction record
    console.log('✅ Testing transaction encryption...');
    const encryptedRecord = await encryptPlaidTransactionFields(transactionRecord);
    console.log('Encrypted successfully');

    // Test 3: Store transaction in database
    console.log('✅ Testing transaction storage...');
    await coll.insertOne(encryptedRecord);
    console.log('Transaction stored successfully');

    // Test 4: Query transaction back from database
    console.log('✅ Testing transaction query...');
    const retrievedTransaction = await coll.findOne({
      userId: testUserId,
      transactionId: transactionRecord.transactionId
    });

    if (retrievedTransaction) {
      console.log('Transaction retrieved successfully:', {
        transactionId: retrievedTransaction.transactionId,
        amount: retrievedTransaction.amount,
        bookingDate: retrievedTransaction.bookingDate,
        description: retrievedTransaction.description,
        counterparty: retrievedTransaction.counterparty
      });
    } else {
      throw new Error('Failed to retrieve stored transaction');
    }

    // Test 5: Query with filters
    console.log('✅ Testing filtered queries...');
    const filteredTransactions = await coll.find({
      userId: testUserId,
      bookingDate: { $gte: '2024-11-01', $lte: '2024-11-30' }
    }).toArray();

    console.log(`Found ${filteredTransactions.length} transactions in date range`);

    // Test 6: Cleanup test data
    console.log('✅ Cleaning up test data...');
    await coll.deleteOne({
      userId: testUserId,
      transactionId: transactionRecord.transactionId
    });
    console.log('Test data cleaned up');

    console.log('🎉 All tests passed! transactions_plaid integration is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Execute test
testTransactionsPlaidIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });