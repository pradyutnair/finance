import 'dotenv/config';
import { getDb, getEncryptedMongoClient } from '../../lib/mongo/client';

/**
 * Drop and recreate collections for explicit encryption
 * 
 * Collections created with createEncryptedCollection() have automatic encryption schemas
 * that don't work well with explicit encryption. This script recreates them as regular
 * collections that will work with explicit encryption.
 */

async function recreateCollections() {
  console.log('🔧 Recreating collections for explicit encryption...\n');
  
  const db = await getDb();
  const client = await getEncryptedMongoClient();
  
  const collections = [
    'requisitions_dev',
    'bank_connections_dev', 
    'bank_accounts_dev',
    'transactions_dev',
    'balances_dev'
  ];
  
  // Drop existing collections (with FLE schema validation)
  for (const collName of collections) {
    try {
      const existing = await db.listCollections({ name: collName }).toArray();
      if (existing.length > 0) {
        console.log(`📦 Dropping existing collection: ${collName}`);
        await db.collection(collName).drop();
        console.log(`   ✅ Dropped ${collName}`);
        
        // Also drop auxiliary collections created by automatic encryption
        const auxCollections = [
          `enxcol_.${collName}.esc`,
          `enxcol_.${collName}.ecc`,
          `enxcol_.${collName}.ecoc`,
        ];
        
        for (const auxColl of auxCollections) {
          try {
            const auxExists = await db.listCollections({ name: auxColl }).toArray();
            if (auxExists.length > 0) {
              await db.collection(auxColl).drop();
              console.log(`   ✅ Dropped auxiliary collection ${auxColl}`);
            }
          } catch (e) {
            // Auxiliary collection might not exist
          }
        }
      } else {
        console.log(`   ⏭️  Collection ${collName} doesn't exist, skipping`);
      }
    } catch (e: any) {
      if (e.message?.includes('ns not found')) {
        console.log(`   ⏭️  Collection ${collName} doesn't exist, skipping`);
      } else {
        console.error(`   ❌ Error dropping ${collName}:`, e.message);
      }
    }
  }
  
  console.log('\n🏗️  Creating new regular collections (no FLE schema)...');
  
  // Create regular collections without FLE validation schemas
  // With explicit encryption, we don't need the collections to have encryptedFields metadata
  // The encryption happens in the application layer before writes
  for (const collName of collections) {
    try {
      await db.createCollection(collName);
      console.log(`   ✅ Created ${collName}`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`   ⏭️  ${collName} already exists`);
      } else {
        console.error(`   ❌ Error creating ${collName}:`, e.message);
      }
    }
  }
  
  console.log('\n📇 Creating indexes on plaintext query fields...');
  
  // Create indexes on plaintext fields (needed for efficient queries)
  // NOTE: accountId is now encrypted (deterministic), but can still be indexed for equality queries
  const indexes = [
    { collection: 'bank_connections_dev', index: { userId: 1, institutionId: 1, createdAt: -1 } },
    { collection: 'bank_accounts_dev', index: { userId: 1 } },
    { collection: 'bank_accounts_dev', index: { institutionId: 1 } },
    { collection: 'transactions_dev', index: { userId: 1, bookingDate: -1 } },
    { collection: 'transactions_dev', index: { userId: 1, category: 1 } },
    { collection: 'requisitions_dev', index: { userId: 1, institutionId: 1 } },
    { collection: 'balances_dev', index: { userId: 1, referenceDate: -1 } },
  ];
  
  for (const { collection, index } of indexes) {
    try {
      await db.collection(collection).createIndex(index);
      console.log(`   ✅ Created index on ${collection}: ${JSON.stringify(index)}`);
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`   ⏭️  Index on ${collection} already exists`);
      } else {
        console.error(`   ❌ Error creating index:`, e.message);
      }
    }
  }
  
  console.log('\n✅ Collections recreated successfully for explicit encryption!');
  console.log('\nℹ️  Collections are now regular MongoDB collections without FLE schema validation.');
  console.log('🔐 Encryption is handled explicitly in the application layer.');
  console.log('📖 Decryption is still automatic when reading data.\n');
  
  // Close client
  await client.close();
  process.exit(0);
}

recreateCollections().catch((e) => {
  console.error('❌ Recreation failed:', e);
  process.exit(1);
});

