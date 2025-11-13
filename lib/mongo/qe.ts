import 'dotenv/config';
import { MongoClient, ClientEncryption } from 'mongodb';
import { getEncryptedMongoClient, getDb, getKeyVaultNamespace } from './client';

type EncryptedFieldsMap = Parameters<MongoClient['db']>[0] extends never ? any : any;

function gcpCustomerMasterKey() {
  return {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION,
    keyRing: process.env.GCP_KEY_RING,
    keyName: process.env.GCP_KEY_NAME,
  };
}

export async function ensureCollections() {
  const db = await getDb();
  const keyVaultNamespace = getKeyVaultNamespace();
  const [kvDb, kvColl] = keyVaultNamespace.split('.');

  // Define encrypted fields maps
  const cmk = gcpCustomerMasterKey();

  // Plaintext fields (for efficient indexing and queries):
  // - userId, institutionId, accountId (all collections)
  // - bookingDate, category, exclude (transactions)
  // - logoUrl, maxAccessValidforDays, transactionTotalDays (connections)
  // - balanceType, referenceDate (balances)
  //
  // Encrypted fields (sensitive data):
  // - requisitionId, status, reference, redirectUri, institutionName
  // - iban, accountName, currency, raw
  // - transactionId, amount, bookingDateTime, valueDate, description, counterparty
  
  const requisitionsEnc: any = {
    encryptedFields: {
      fields: [
        { path: 'requisitionId', bsonType: 'string' },
        { path: 'status', bsonType: 'string' },
        { path: 'reference', bsonType: 'string' },
        { path: 'redirectUri', bsonType: 'string' },
        { path: 'institutionName', bsonType: 'string' },
      ],
    },
  };

  const bankConnectionsEnc: any = {
    encryptedFields: {
      fields: [
        { path: 'requisitionId', bsonType: 'string' },
        { path: 'status', bsonType: 'string' },
        { path: 'institutionName', bsonType: 'string' },
      ],
    },
  };

  const bankAccountsEnc: any = {
    encryptedFields: {
      fields: [
        { path: 'iban', bsonType: 'string' },
        { path: 'accountName', bsonType: 'string' },
        { path: 'currency', bsonType: 'string' },
        { path: 'status', bsonType: 'string' },
        { path: 'raw', bsonType: 'string' },
        { path: 'institutionName', bsonType: 'string' },
      ],
    },
  };

  const transactionsEnc: any = {
    encryptedFields: {
      fields: [
        { path: 'transactionId', bsonType: 'string' },
        { path: 'amount', bsonType: 'string' },
        { path: 'currency', bsonType: 'string' },
        { path: 'bookingDateTime', bsonType: 'string' },
        { path: 'valueDate', bsonType: 'string' },
        { path: 'description', bsonType: 'string' },
        { path: 'counterparty', bsonType: 'string' },
        { path: 'raw', bsonType: 'string' },
      ],
    },
  };

  // Ensure key vault exists
  const client = await getEncryptedMongoClient();
  const admin = client.db(kvDb);
  const existingKv = await admin.listCollections({ name: kvColl }).toArray();
  if (existingKv.length === 0) {
    await admin.createCollection(kvColl);
    await admin.collection(kvColl).createIndex(
      { keyAltNames: 1 },
      { unique: true, partialFilterExpression: { keyAltNames: { $exists: true } } }
    );
  }

  // Use ClientEncryption to create encrypted collections with GCP CMK
  const gcpEmail = process.env.GCP_EMAIL as string;
  const gcpPrivateKeyRaw = process.env.GCP_PRIVATE_KEY as string;
  const gcpPrivateKey = gcpPrivateKeyRaw.includes('\n') ? gcpPrivateKeyRaw : gcpPrivateKeyRaw.replace(/\\n/g, '\n');
  
  const kmsProviders = {
    gcp: {
      email: gcpEmail,
      privateKey: gcpPrivateKey,
    },
  };

  const ce = new ClientEncryption(client as any, { 
    keyVaultNamespace,
    kmsProviders 
  });

  async function ensureEncCollection(name: string, encFields: any) {
    const list = await db.listCollections({ name }).toArray();
    if (list.length === 0) {
      await ce.createEncryptedCollection(db, name, {
        provider: 'gcp' as any,
        createCollectionOptions: encFields,
        masterKey: cmk,
      } as any);
    }
  }

  // Define balances encrypted fields
  // Plaintext: userId, accountId, balanceType, referenceDate (needed for indexing/querying)
  // Only balanceAmount and currency are encrypted
  const balancesEnc: any = {
    encryptedFields: {
      fields: [
        { path: 'balanceAmount', bsonType: 'string' },
        { path: 'currency', bsonType: 'string' },
      ],
    },
  };

  await ensureEncCollection('requisitions_dev', requisitionsEnc);
  await ensureEncCollection('bank_connections_dev', bankConnectionsEnc);
  await ensureEncCollection('bank_accounts_dev', bankAccountsEnc);
  await ensureEncCollection('transactions_plaid', transactionsEnc);
  await ensureEncCollection('balances_dev', balancesEnc);

  // Indexes for plaintext query fields only (cannot index encrypted fields)
  // Note: Equality-encrypted fields (accountId, transactionId, etc.) get auto-indexes via __safeContent__
  try {
    await db.collection('bank_connections_dev').createIndex({ userId: 1, institutionId: 1, createdAt: -1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
  
  try {
    await db.collection('bank_accounts_dev').createIndex({ userId: 1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
  
  try {
    await db.collection('bank_accounts_dev').createIndex({ institutionId: 1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
  
  try {
    await db.collection('transactions_plaid').createIndex({ userId: 1, bookingDate: -1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
  
  try {
    await db.collection('requisitions_dev').createIndex({ userId: 1, institutionId: 1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
  
  try {
    await db.collection('balances_dev').createIndex({ userId: 1, referenceDate: -1 });
  } catch (e: any) {
    if (!e.message?.includes('already exists')) console.warn('Index creation warning:', e.message);
  }
}


