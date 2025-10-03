/**
 * MongoDB Queryable Encryption Client
 * Simple setup with automatic encryption/decryption
 */
import 'server-only';
import { MongoClient, Db } from 'mongodb';
import { ClientEncryption } from 'mongodb-client-encryption';

let client: MongoClient | null = null;
let db: Db | null = null;

// Encrypted fields configuration
const encryptedFieldsMap = {
  'nexpass.transactions': {
    fields: [
      {
        path: 'description',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'counterparty',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'merchantName',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
  'nexpass.bank_accounts': {
    fields: [
      {
        path: 'iban',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'accountName',
        bsonType: 'string',
      },
      {
        path: 'ownerName',
        bsonType: 'string',
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
  'nexpass.bank_balances': {
    fields: [
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
  'nexpass.bank_connections': {
    fields: [
      {
        path: 'agreementId',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
  'nexpass.requisitions': {
    fields: [
      {
        path: 'reference',
        bsonType: 'string',
        queries: { queryType: 'equality' as const },
      },
      {
        path: 'redirectUri',
        bsonType: 'string',
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
};

export async function getMongoClient(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'nexpass';
  const localMasterKey = process.env.MONGODB_LOCAL_MASTER_KEY;

  if (!uri) {
    throw new Error('MONGODB_URI not set');
  }

  if (!localMasterKey) {
    throw new Error('MONGODB_LOCAL_MASTER_KEY not set. Run: node scripts/setup-mongodb.js');
  }

  // Auto-encryption configuration
  const autoEncryptionOpts = {
    keyVaultNamespace: 'encryption.__keyVault',
    kmsProviders: {
      local: {
        key: Buffer.from(localMasterKey, 'base64'),
      },
    },
    encryptedFieldsMap,
  };

  client = new MongoClient(uri, { autoEncryption: autoEncryptionOpts } as any);
  await client.connect();
  db = client.db(dbName);

  console.log('✅ MongoDB connected with queryable encryption');

  return { client, db };
}

export async function getDb(): Promise<Db> {
  const { db } = await getMongoClient();
  return db;
}

// Helper to create data encryption keys (run once during setup)
export async function setupEncryptionKeys() {
  const uri = process.env.MONGODB_URI;
  const localMasterKey = process.env.MONGODB_LOCAL_MASTER_KEY;

  if (!uri || !localMasterKey) {
    throw new Error('Missing environment variables');
  }

  const setupClient = new MongoClient(uri);
  await setupClient.connect();

  const encryption = new ClientEncryption(setupClient, {
    keyVaultNamespace: 'encryption.__keyVault',
    kmsProviders: {
      local: {
        key: Buffer.from(localMasterKey, 'base64'),
      },
    },
  });

  const collections = [
    'nexpass.transactions',
    'nexpass.bank_accounts',
    'nexpass.bank_balances',
    'nexpass.bank_connections',
    'nexpass.requisitions',
  ];

  console.log('\n🔑 Creating encryption keys...\n');

  for (const coll of collections) {
    try {
      await encryption.createDataKey('local', { keyAltNames: [coll] });
      console.log(`✅ ${coll}`);
    } catch (err: any) {
      if (err.message.includes('duplicate')) {
        console.log(`⚠️  ${coll} (already exists)`);
      } else {
        throw err;
      }
    }
  }

  await setupClient.close();
  console.log('\n✅ Encryption keys ready\n');
}
