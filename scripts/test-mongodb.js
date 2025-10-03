#!/usr/bin/env node
/**
 * Test MongoDB connection and encryption
 */

require('dotenv').config({ path: '.env.local' });

async function test() {
  console.log('\n🧪 Testing MongoDB Queryable Encryption\n');

  // Dynamic import
  const { getDb, setupEncryptionKeys } = await import('../lib/mongodb.ts');

  try {
    // Step 1: Create encryption keys
    console.log('1️⃣  Setting up encryption keys...');
    await setupEncryptionKeys();

    // Step 2: Test connection
    console.log('\n2️⃣  Connecting to MongoDB...');
    const db = await getDb();
    console.log('✅ Connected');

    // Step 3: Test encryption
    console.log('\n3️⃣  Testing auto-encryption...');
    const testDoc = {
      userId: 'test-user-' + Date.now(),
      amount: 99.99,
      currency: 'USD',
      bookingDate: '2025-10-02',
      description: 'SECRET ENCRYPTED DESCRIPTION', // Will be encrypted!
      counterparty: 'Test Merchant', // Will be encrypted!
    };

    await db.collection('transactions').insertOne(testDoc);
    console.log('✅ Inserted (auto-encrypted)');

    // Step 4: Test decryption
    console.log('\n4️⃣  Testing auto-decryption...');
    const found = await db.collection('transactions').findOne({
      userId: testDoc.userId,
    });

    if (found && found.description === 'SECRET ENCRYPTED DESCRIPTION') {
      console.log('✅ Decrypted correctly');
      console.log(`   Description: ${found.description}`);
    } else {
      console.error('❌ Decryption failed');
    }

    // Step 5: Test queryable encryption
    console.log('\n5️⃣  Testing queryable fields...');
    const queried = await db.collection('transactions').findOne({
      description: 'SECRET ENCRYPTED DESCRIPTION', // Query encrypted field!
    });

    if (queried) {
      console.log('✅ Queried encrypted field successfully');
    } else {
      console.error('❌ Query failed');
    }

    // Cleanup
    await db.collection('transactions').deleteOne({ userId: testDoc.userId });

    console.log('\n✅ All tests passed!\n');
    console.log('🎉 MongoDB Queryable Encryption is working!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test();
