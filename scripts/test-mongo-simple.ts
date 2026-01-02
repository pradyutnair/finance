import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function testSimpleConnection() {
  try {
    const uri = process.env.MONGODB_URI as string;
    if (!uri) {
      throw new Error('MONGODB_URI is not set');
    }

    // Test simple connection without encryption
    const client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected to MongoDB (simple connection)');
    
    const db = client.db(process.env.MONGODB_DB || 'finance_dev');
    console.log('📊 Database:', db.databaseName);
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections:', collections.map(c => c.name));
    
    // Check transactions
    const coll = db.collection('transactions_dev');
    const count = await coll.countDocuments();
    console.log('📊 Total transactions:', count);
    
    // Get a sample
    const sample = await coll.findOne({});
    if (sample) {
      console.log('\n📄 Sample document:');
      console.log('  Keys:', Object.keys(sample));
      console.log('  userId:', sample.userId);
      console.log('  bookingDate:', sample.bookingDate);
      console.log('  amount:', sample.amount);
      console.log('  amount type:', typeof sample.amount, sample.amount?.constructor?.name);
    }
    
    await client.close();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

testSimpleConnection();

