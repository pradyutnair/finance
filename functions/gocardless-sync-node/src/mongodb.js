/**
 * MongoDB client with Explicit Encryption for Serverless
 * Uses bypass_auto_encryption mode - manually encrypt writes, auto-decrypt reads
 */

import { MongoClient, Binary } from 'mongodb';
import { ClientEncryption } from 'mongodb-client-encryption';

let clientPromise = null;
let clientEncryptionInstance = null;
let dataKeyId = null;

function getMongoDbName() {
  return process.env.MONGODB_DB || 'finance_dev';
}

function getKeyVaultNamespace() {
  return process.env.MONGODB_KEY_VAULT_NS || 'encryption.__keyVault';
}

function getKmsProviders() {
  const gcpEmail = process.env.GCP_EMAIL;
  const gcpPrivateKeyRaw = process.env.GCP_PRIVATE_KEY;
  
  if (!gcpEmail || !gcpPrivateKeyRaw) {
    throw new Error('GCP_EMAIL and GCP_PRIVATE_KEY are required for encryption');
  }
  
  const gcpPrivateKey = gcpPrivateKeyRaw.includes('\n') 
    ? gcpPrivateKeyRaw 
    : gcpPrivateKeyRaw.replace(/\\n/g, '\n');

  return {
    gcp: {
      email: gcpEmail,
      privateKey: gcpPrivateKey,
    },
  };
}

export async function getEncryptedMongoClient() {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const kmsProviders = getKmsProviders();
  const keyVaultNamespace = getKeyVaultNamespace();

  clientPromise = (async () => {
    const client = new MongoClient(uri, {
      autoEncryption: {
        keyVaultNamespace,
        kmsProviders,
        bypassAutoEncryption: true, // Explicit encryption for serverless
      },
    });
    await client.connect();
    return client;
  })();

  return clientPromise;
}

export async function getClientEncryption() {
  if (clientEncryptionInstance) return clientEncryptionInstance;

  const client = await getEncryptedMongoClient();
  const kmsProviders = getKmsProviders();
  const keyVaultNamespace = getKeyVaultNamespace();

  clientEncryptionInstance = new ClientEncryption(client, {
    keyVaultNamespace,
    kmsProviders,
  });

  return clientEncryptionInstance;
}

export async function getDataKeyId() {
  if (dataKeyId) return dataKeyId;

  const client = await getEncryptedMongoClient();
  const clientEncryption = await getClientEncryption();
  const keyVaultNamespace = getKeyVaultNamespace();
  const [kvDb, kvColl] = keyVaultNamespace.split('.');

  const keyAltName = 'nexpass-data-key';
  const keyVault = client.db(kvDb).collection(kvColl);
  const keys = await keyVault.find({ keyAltNames: keyAltName }).toArray();

  if (keys.length > 0) {
    dataKeyId = keys[0]._id;
    return dataKeyId;
  }

  // Create new key
  const gcpMasterKey = {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION,
    keyRing: process.env.GCP_KEY_RING,
    keyName: process.env.GCP_KEY_NAME,
  };

  dataKeyId = await clientEncryption.createDataKey('gcp', {
    masterKey: gcpMasterKey,
    keyAltNames: [keyAltName],
  });

  return dataKeyId;
}

export async function getDb() {
  const client = await getEncryptedMongoClient();
  return client.db(getMongoDbName());
}

export async function getUserBankAccounts(userId) {
  const db = await getDb();
  const collection = db.collection('bank_accounts_dev');
  
  // Query by plaintext userId, accounts are auto-decrypted
  const accounts = await collection.find({ userId }).toArray();
  return accounts;
}

export async function getLastBookingDate(userId, accountId) {
  const db = await getDb();
  const collection = db.collection('transactions_dev');
  const { encryptQueryable } = await import('./explicit-encryption.js');
  
  try {
    // Query using encrypted accountId (deterministic)
    const encryptedAccountId = await encryptQueryable(accountId);
    
    const result = await collection.findOne(
      { userId, accountId: encryptedAccountId },
      { sort: { bookingDate: -1 } }
    );
    
    return result?.bookingDate || result?.valueDate || null;
  } catch {
    return null;
  }
}

export async function documentExists(collectionName, docId) {
  const db = await getDb();
  const collection = db.collection(collectionName);
  
  try {
    const result = await collection.findOne({ _id: docId });
    return result !== null;
  } catch {
    return false;
  }
}

export async function findBalanceDocument(userId, accountId, balanceType) {
  const db = await getDb();
  const collection = db.collection('balances_dev');
  const { encryptQueryable } = await import('./explicit-encryption.js');
  
  try {
    const encryptedAccountId = await encryptQueryable(accountId);
    
    const result = await collection.findOne({
      userId,
      accountId: encryptedAccountId,
      balanceType,
    });
    
    return result?._id?.toString() || null;
  } catch {
    return null;
  }
}

export async function createTransaction(docId, encryptedPayload) {
  const db = await getDb();
  const collection = db.collection('transactions_dev');
  
  encryptedPayload._id = docId;
  await collection.insertOne(encryptedPayload);
}

export async function createBalance(docId, encryptedPayload) {
  const db = await getDb();
  const collection = db.collection('balances_dev');
  
  encryptedPayload._id = docId;
  await collection.insertOne(encryptedPayload);
}

export async function updateBalance(docId, encryptedPayload) {
  const db = await getDb();
  const collection = db.collection('balances_dev');
  
  encryptedPayload.updatedAt = new Date().toISOString();
  await collection.updateOne(
    { _id: docId },
    { $set: encryptedPayload }
  );
}

