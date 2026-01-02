import 'dotenv/config';
import { getDb } from '../lib/mongo/client';

async function testConnection() {
  try {
    const db = await getDb();
    console.log('✅ Connected to MongoDB:', db.databaseName);
    
    // Check if transactions collection exists and count documents
    const coll = db.collection('transactions_dev');
    const count = await coll.countDocuments();
    console.log('📊 Total transactions in collection:', count);
    
    // Get a sample document to see structure
    const sample = await coll.findOne({});
    if (sample) {
      console.log('\n📄 Sample document structure:');
      console.log('  Keys:', Object.keys(sample));
      console.log('  userId:', sample.userId);
      console.log('  bookingDate:', sample.bookingDate);
      console.log('  category:', sample.category);
      console.log('  amount type:', typeof sample.amount, sample.amount?.constructor?.name);
      console.log('  description type:', typeof sample.description, sample.description?.constructor?.name);
      console.log('  accountId type:', typeof sample.accountId, sample.accountId?.constructor?.name);
      
      // Check if it's a Binary object
      if (sample.amount && typeof sample.amount === 'object') {
        console.log('  amount is Binary:', sample.amount.constructor.name === 'Binary');
      }
    } else {
      console.log('⚠️  No documents found in collection');
    }
    
    // Test query by userId
    const userId = process.argv[2] || '68d446e7bf3ed043310a';
    console.log(`\n🔍 Testing query for userId: ${userId}`);
    const userDocs = await coll.find({ userId }).limit(5).toArray();
    console.log(`  Found ${userDocs.length} documents for this user`);
    
    if (userDocs.length > 0) {
      const doc = userDocs[0];
      console.log('  First document:');
      console.log('    userId:', doc.userId);
      console.log('    bookingDate:', doc.bookingDate);
      console.log('    amount:', doc.amount);
      console.log('    description:', doc.description);
    }
    
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

testConnection();

