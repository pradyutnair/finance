import 'dotenv/config';
import { MongoClient, Db, ClientEncryption } from 'mongodb';

// Singleton encrypted client for Explicit Encryption (GCP KMS)
// Using bypassAutoEncryption for serverless compatibility
let clientPromise: Promise<MongoClient> | null = null;
let simpleClientPromise: Promise<MongoClient> | null = null;
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
  
  // Convert literal \n to actual newlines if needed
  // Check if it has actual newlines (from file) or literal \n (from env var)
  let gcpPrivateKey: string;
  if (gcpPrivateKeyRaw.includes('\n') && !gcpPrivateKeyRaw.includes('\\n')) {
    // Already has actual newlines
    gcpPrivateKey = gcpPrivateKeyRaw.trim();
  } else {
    // Has literal \n characters, convert them
    gcpPrivateKey = gcpPrivateKeyRaw.replace(/\\n/g, '\n').trim();
  }

  // Ensure the key starts and ends correctly
  if (!gcpPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('GCP_PRIVATE_KEY must start with -----BEGIN PRIVATE KEY-----');
  }
  if (!gcpPrivateKey.endsWith('-----END PRIVATE KEY-----')) {
    throw new Error('GCP_PRIVATE_KEY must end with -----END PRIVATE KEY-----');
  }

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

  const keyVaultNamespace = getKeyVaultNamespace();

  clientPromise = (async () => {
    // Use bypassAutoEncryption for explicit encryption (serverless compatible)
    // This means:
    // 1. We manually encrypt data before writes
    // 2. Decryption is still automatic on reads (if KMS is configured)
    // 3. No need for mongocryptd or shared libraries
    // NOTE: With bypassAutoEncryption: true, KMS providers are optional in MongoClient
    // They are required for ClientEncryption (explicit encryption/decryption)
    // For automatic decryption on read, we can configure KMS providers here
    try {
      const kmsProviders = getKmsProviders();
      const client = new MongoClient(uri, {
        autoEncryption: {
          keyVaultNamespace,
          kmsProviders,
          bypassAutoEncryption: true, // CRITICAL: Enables explicit encryption for serverless
        },
      } as any);
      await client.connect();
      return client;
    } catch (kmsError: any) {
      // If KMS config fails, create client without KMS providers
      // Automatic decryption won't work, but we can still read encrypted Binary objects
      // and decrypt them manually using ClientEncryption if needed
      console.warn('[MongoDB] KMS provider config failed, creating client without KMS:', kmsError.message);
      const client = new MongoClient(uri, {
        autoEncryption: {
          keyVaultNamespace,
          bypassAutoEncryption: true,
          // No KMS providers - automatic decryption disabled, but reads still work
        },
      } as any);
      await client.connect();
      return client;
    }
  })();

  return clientPromise;
}

export async function getClientEncryption(): Promise<ClientEncryption> {
  if (clientEncryptionInstance) return clientEncryptionInstance;

  // Use simple client for ClientEncryption to avoid KMS validation issues in MongoClient
  const client = await getSimpleMongoClient();
  const keyVaultNamespace = getKeyVaultNamespace();

  try {
    const kmsProviders = getKmsProviders();
    clientEncryptionInstance = new ClientEncryption(client as any, {
      keyVaultNamespace,
      kmsProviders,
    });
    return clientEncryptionInstance;
  } catch (error: any) {
    // If KMS providers fail, we can't create ClientEncryption
    // This means encryption/decryption won't work, but the app can still read plaintext data
    throw new Error(`Failed to initialize ClientEncryption: ${error.message}. Please check GCP KMS configuration.`);
  }
}

export async function getSimpleMongoClient(): Promise<MongoClient> {
  if (simpleClientPromise) return simpleClientPromise;

  const uri = process.env.MONGODB_URI as string;
  if (!uri) throw new Error('MONGODB_URI is not set');

  simpleClientPromise = (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    return client;
  })();

  return simpleClientPromise;
}

export async function getDb(): Promise<Db> {
  // Try encrypted client first, fallback to simple client if KMS fails
  try {
    const client = await getEncryptedMongoClient();
    return client.db(getMongoDbName());
  } catch (error: any) {
    // If KMS configuration fails, use simple client for reading
    // This allows the app to work even if KMS setup has issues
    console.warn('[MongoDB] Encrypted client failed, using simple client:', error.message);
    const simpleClient = await getSimpleMongoClient();
    return simpleClient.db(getMongoDbName());
  }
}


