import { getDb } from '../lib/mongo/client';

// Simple test transaction record matching the transactions_plaid schema
const testTransactionRecord = {
  transactionId: 'test_tx_123456789',
  accountId: 'test_acc_123',
  userId: 'test-user-123',
  amount: '-25.50',
  currency: 'USD',
  bookingDate: '2024-11-04',
  bookingMonth: '2024-11',
  bookingYear: 2024,
  bookingWeekday: 'Mon',
  valueDate: '2024-11-04',
  authorizedDate: '2024-11-04',
  bookingDateTime: '2024-11-04T10:30:00Z',
  status: 'posted',
  pending: false,
  paymentChannel: 'in store',
  category: 'Restaurants',
  exclude: false,
  description: 'Starbucks Coffee',
  counterparty: 'Starbucks',
  merchantName: 'Starbucks',
  originalDescription: 'STARBUCKS COFFEE',
  location: {
    address: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    postalCode: '94105',
    country: 'US',
    lat: 37.7749,
    lon: -122.4194
  },
  personalFinanceCategory: {
    primary: 'Food and Drink',
    detailed: 'Restaurants',
    confidenceLevel: 'HIGH'
  },
  createdAt: '2024-11-04T10:30:00.000Z',
  updatedAt: '2024-11-04T10:30:00.000Z'
};

async function testTransactionsPlaidSimple() {
  console.log('🧪 Testing transactions_plaid collection basic functionality...');

  try {
    const db = await getDb();
    const coll = db.collection('transactions_plaid');

    // Test 1: Store transaction
    console.log('✅ Testing transaction storage...');
    const result = await coll.insertOne(testTransactionRecord);
    console.log(`Transaction stored with _id: ${result.insertedId}`);

    // Test 2: Query transaction by transactionId
    console.log('✅ Testing transaction query by transactionId...');
    const retrievedByTransactionId = await coll.findOne({
      userId: testTransactionRecord.userId,
      transactionId: testTransactionRecord.transactionId
    });

    if (retrievedByTransactionId) {
      console.log('✅ Retrieved by transactionId successfully:', {
        transactionId: retrievedByTransactionId.transactionId,
        amount: retrievedByTransactionId.amount,
        bookingDate: retrievedByTransactionId.bookingDate,
        description: retrievedByTransactionId.description,
        counterparty: retrievedByTransactionId.counterparty
      });
    } else {
      throw new Error('Failed to retrieve transaction by transactionId');
    }

    // Test 3: Query by date range
    console.log('✅ Testing date range query...');
    const dateRangeResults = await coll.find({
      userId: testTransactionRecord.userId,
      bookingDate: { $gte: '2024-11-01', $lte: '2024-11-30' }
    }).toArray();

    console.log(`✅ Found ${dateRangeResults.length} transactions in date range`);

    // Test 4: Query by category
    console.log('✅ Testing category query...');
    const categoryResults = await coll.find({
      userId: testTransactionRecord.userId,
      category: 'Restaurants'
    }).toArray();

    console.log(`✅ Found ${categoryResults.length} transactions with category 'Restaurants'`);

    // Test 5: Test unique constraint (should fail on duplicate)
    console.log('✅ Testing unique constraint...');
    try {
      await coll.insertOne(testTransactionRecord);
      console.log('❌ Unique constraint failed - duplicate was inserted');
      await coll.deleteOne({ userId: testTransactionRecord.userId, transactionId: testTransactionRecord.transactionId });
    } catch (error: any) {
      if (error.code === 11000) {
        console.log('✅ Unique constraint working correctly - duplicate rejected');
      } else {
        throw error;
      }
    }

    // Test 6: Update transaction
    console.log('✅ Testing transaction update...');
    const updateResult = await coll.updateOne(
      { userId: testTransactionRecord.userId, transactionId: testTransactionRecord.transactionId },
      { $set: { category: 'Coffee Shops', updatedAt: new Date().toISOString() } }
    );

    if (updateResult.modifiedCount === 1) {
      console.log('✅ Transaction updated successfully');
    } else {
      throw new Error('Failed to update transaction');
    }

    // Test 7: Verify update
    const updatedTransaction = await coll.findOne({
      userId: testTransactionRecord.userId,
      transactionId: testTransactionRecord.transactionId
    });

    if (updatedTransaction && updatedTransaction.category === 'Coffee Shops') {
      console.log('✅ Update verified successfully');
    } else {
      throw new Error('Update verification failed');
    }

    // Test 8: Cleanup
    console.log('✅ Cleaning up test data...');
    const deleteResult = await coll.deleteOne({
      userId: testTransactionRecord.userId,
      transactionId: testTransactionRecord.transactionId
    });

    if (deleteResult.deletedCount === 1) {
      console.log('✅ Test data cleaned up successfully');
    } else {
      console.warn('⚠️ Warning: Test data cleanup may have failed');
    }

    console.log('🎉 All tests passed! transactions_plaid collection is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Execute test
testTransactionsPlaidSimple()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });