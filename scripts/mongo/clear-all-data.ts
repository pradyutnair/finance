import 'dotenv/config';
import { getDb, getMongoDbName } from '../../lib/mongo/client';

async function clearAllData() {
  console.log('🚨 WARNING: This will delete ALL data from MongoDB database!');
  console.log(`Database: ${getMongoDbName()}`);
  
  // Add a 5-second delay to give user time to cancel
  console.log('⏰ Starting in 5 seconds... Press Ctrl+C to cancel');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const db = await getDb();
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Delete all documents from each collection
    for (const collection of collections) {
      const coll = db.collection(collection.name);
      const result = await coll.deleteMany({});
      console.log(`✅ Deleted ${result.deletedCount} documents from ${collection.name}`);
    }
    
    // Also clear the key vault if it exists
    const keyVaultDb = db.client.db('encryption');
    const keyVaultCollections = await keyVaultDb.listCollections().toArray();
    
    if (keyVaultCollections.length > 0) {
      console.log('\n🔐 Clearing key vault collections:');
      for (const collection of keyVaultCollections) {
        const coll = keyVaultDb.collection(collection.name);
        const result = await coll.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} documents from encryption.${collection.name}`);
      }
    }
    
    console.log('\n🎉 All data cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Add confirmation prompt
async function confirmAndClear() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('Are you sure you want to delete ALL data? Type "DELETE" to confirm: ', resolve);
  });
  
  rl.close();
  
  if (answer === 'DELETE') {
    await clearAllData();
  } else {
    console.log('❌ Operation cancelled.');
    process.exit(0);
  }
}

// Run the script
confirmAndClear().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
