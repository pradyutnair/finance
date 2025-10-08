import 'dotenv/config';
import { MongoClient, Db, ClientEncryption } from 'mongodb';

// Singleton encrypted client for Explicit Encryption (GCP KMS)
// Using bypassAutoEncryption for serverless compatibility
let clientPromise: Promise<MongoClient> | null = null;
let clientEncryptionInstance: ClientEncryption | null = null;

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || 'finance_dev';
}

export function getKeyVaultNamespace(): string {
  return process.env.MONGODB_KEY_VAULT_NS || 'encryption.__keyVault';
}

export function getKmsProviders() {
  const gcpEmail = process.env.GCP_EMAIL as string;
  const gcpPrivateKeyRaw = process.env.GCP_PRIVATE_KEY as string;
  if (!gcpEmail || !gcpPrivateKeyRaw) throw new Error('GCP_EMAIL or GCP_PRIVATE_KEY is not set');
  const gcpPrivateKey = gcpPrivateKeyRaw.includes('\n') ? gcpPrivateKeyRaw : gcpPrivateKeyRaw.replace(/\\n/g, '\n');

  return {
    gcp: {
      email: gcpEmail,
      privateKey: gcpPrivateKey,
    },
  } as any;
}

export async function getEncryptedMongoClient(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI as string;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const kmsProviders = getKmsProviders();
  const keyVaultNamespace = getKeyVaultNamespace();

  clientPromise = (async () => {
    // Use bypassAutoEncryption for explicit encryption (serverless compatible)
    // This means:
    // 1. We manually encrypt data before writes
    // 2. Decryption is still automatic on reads
    // 3. No need for mongocryptd or shared libraries
    const client = new MongoClient(uri, {
      autoEncryption: {
        keyVaultNamespace,
        kmsProviders,
        bypassAutoEncryption: true, // CRITICAL: Enables explicit encryption for serverless
      },
    } as any);
    await client.connect();
    return client;
  })();

  return clientPromise;
}

export async function getClientEncryption(): Promise<ClientEncryption> {
  if (clientEncryptionInstance) return clientEncryptionInstance;

  const client = await getEncryptedMongoClient();
  const kmsProviders = getKmsProviders();
  const keyVaultNamespace = getKeyVaultNamespace();

  clientEncryptionInstance = new ClientEncryption(client as any, {
    keyVaultNamespace,
    kmsProviders,
  });

  return clientEncryptionInstance;
}

export async function getDb(): Promise<Db> {
  const client = await getEncryptedMongoClient();
  return client.db(getMongoDbName());
}


