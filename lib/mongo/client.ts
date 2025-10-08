import 'dotenv/config';
import { MongoClient, Db } from 'mongodb';

// Singleton encrypted client for Queryable Encryption (GCP KMS)
let clientPromise: Promise<MongoClient> | null = null;

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || 'finance_dev';
}

export function getKeyVaultNamespace(): string {
  return process.env.MONGODB_KEY_VAULT_NS || 'encryption.__keyVault';
}

export async function getEncryptedMongoClient(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI as string;
  if (!uri) throw new Error('MONGODB_URI is not set');

  const gcpEmail = process.env.GCP_EMAIL as string;
  const gcpPrivateKeyRaw = process.env.GCP_PRIVATE_KEY as string;
  if (!gcpEmail || !gcpPrivateKeyRaw) throw new Error('GCP_EMAIL or GCP_PRIVATE_KEY is not set');
  const gcpPrivateKey = gcpPrivateKeyRaw.includes('\n') ? gcpPrivateKeyRaw : gcpPrivateKeyRaw.replace(/\\n/g, '\n');

  const cryptSharedLibPath = process.env.SHARED_LIB_PATH as string | undefined;

  const kmsProviders = {
    gcp: {
      email: gcpEmail,
      privateKey: gcpPrivateKey,
    },
  } as any;

  const keyVaultNamespace = getKeyVaultNamespace();

  clientPromise = (async () => {
    const client = new MongoClient(uri, {
      autoEncryption: {
        keyVaultNamespace,
        kmsProviders,
        extraOptions: cryptSharedLibPath ? { cryptSharedLibPath } : undefined,
      },
    } as any);
    await client.connect();
    return client;
  })();

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getEncryptedMongoClient();
  return client.db(getMongoDbName());
}


