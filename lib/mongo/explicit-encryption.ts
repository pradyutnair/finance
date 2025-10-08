import 'dotenv/config';
import { getClientEncryption, getKeyVaultNamespace } from './client';
import { Binary } from 'mongodb';

/**
 * Explicit Encryption Helpers for Serverless Environments
 * 
 * This module provides functions to manually encrypt sensitive data before storing in MongoDB.
 * Uses bypassAutoEncryption mode for compatibility with Vercel, Appwrite Functions, etc.
 * 
 * Key Features:
 * - Explicit encryption before writes (manual)
 * - Automatic decryption on reads (handled by MongoDB driver)
 * - Queryable equality encryption (deterministic) for fields we need to query
 * - Random encryption for maximum security on non-queryable fields
 * - No mongocryptd or shared library dependencies
 */

// Get or create data encryption key
let dataKeyId: Binary | null = null;

async function getDataKeyId(): Promise<Binary> {
  if (dataKeyId) return dataKeyId;

  const clientEncryption = await getClientEncryption();
  const keyVaultNamespace = getKeyVaultNamespace();
  const [kvDb, kvColl] = keyVaultNamespace.split('.');
  
  const keyAltName = 'nexpass-data-key';
  
  // Try to find existing key by alternate name
  // Use the encryption client's keyVault helper or access via getDb
  const { getDb: getDbFunc } = await import('./client');
  const db = await getDbFunc();
  const keyVaultDb = db.client.db(kvDb);
  const keys = await keyVaultDb.collection(kvColl).find({ keyAltNames: keyAltName }).toArray();
  
  if (keys.length > 0) {
    dataKeyId = keys[0]._id;
    console.log('🔑 Using existing data encryption key');
    return dataKeyId;
  }

  // Create new key if not found
  console.log('🔑 Creating new data encryption key...');
  const gcpCustomerMasterKey = {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION,
    keyRing: process.env.GCP_KEY_RING,
    keyName: process.env.GCP_KEY_NAME,
  };

  dataKeyId = await clientEncryption.createDataKey('gcp', {
    masterKey: gcpCustomerMasterKey,
    keyAltNames: [keyAltName],
  } as any);

  console.log('✅ Created data encryption key');
  return dataKeyId;
}

/**
 * Encrypt a field value for equality queries (deterministic encryption)
 * Use this for fields you need to query with equality (e.g., accountId, transactionId)
 * 
 * @param value - The value to encrypt
 * @returns Encrypted Binary value (automatically decrypted on read)
 */
export async function encryptQueryable(value: string | null | undefined): Promise<Binary | null> {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  // Use deterministic encryption for queryable fields
  const encrypted = await clientEncryption.encrypt(value, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
    keyId,
  } as any);
  
  return encrypted;
}

/**
 * Encrypt a field value with random encryption (maximum security)
 * Use this for sensitive fields that don't need to be queried
 * 
 * @param value - The value to encrypt
 * @returns Encrypted Binary value (automatically decrypted on read)
 */
export async function encryptRandom(value: string | number | null | undefined): Promise<Binary | null> {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  // Convert to string for encryption
  const stringValue = typeof value === 'number' ? String(value) : value;
  
  // Use random encryption for non-queryable fields (more secure)
  const encrypted = await clientEncryption.encrypt(stringValue, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random',
    keyId,
  } as any);
  
  return encrypted;
}

/**
 * Helper to encrypt all requisition fields
 */
export async function encryptRequisitionFields(requisition: any, userId: string) {
  return {
    userId, // Plaintext - needed for queries
    institutionId: requisition.institution_id, // Plaintext - needed for queries
    
    // Encrypted fields
    requisitionId: await encryptQueryable(requisition.id),
    status: await encryptRandom(requisition.status),
    reference: await encryptRandom(requisition.reference),
    redirectUri: await encryptRandom(requisition.redirect || process.env.GC_REDIRECT_URI),
    institutionName: await encryptRandom(requisition.institution_name),
    
    updatedAt: new Date().toISOString(), // Plaintext metadata
  };
}

/**
 * Helper to encrypt bank connection fields
 */
export async function encryptBankConnectionFields(
  userId: string,
  institutionId: string,
  institutionName: string,
  requisitionId: string,
  logoUrl: string | null,
  transactionTotalDays: number | null,
  maxAccessValidforDays: number | null
) {
  return {
    userId, // Plaintext - needed for queries
    institutionId, // Plaintext - needed for queries
    
    // Encrypted fields
    institutionName: await encryptRandom(institutionName),
    requisitionId: await encryptQueryable(requisitionId),
    status: await encryptRandom('active'),
    
    // Plaintext metadata (not sensitive)
    logoUrl,
    transactionTotalDays,
    maxAccessValidforDays,
    
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to encrypt bank account fields
 */
export async function encryptBankAccountFields(
  accountId: string,
  userId: string,
  institutionId: string,
  institutionName: string,
  accountDetails: any
) {
  return {
    userId, // Plaintext - needed for queries
    institutionId, // Plaintext - needed for queries
    
    // Encrypted queryable field (deterministic - needed for account lookups)
    accountId: await encryptQueryable(accountId),
    
    // Encrypted sensitive fields
    iban: await encryptRandom(accountDetails.iban),
    accountName: await encryptRandom(accountDetails.name),
    currency: await encryptRandom(accountDetails.currency),
    institutionName: await encryptRandom(institutionName),
    status: await encryptRandom('active'),
    raw: await encryptRandom(JSON.stringify(accountDetails)),
    
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to encrypt balance fields
 */
export async function encryptBalanceFields(
  userId: string,
  accountId: string,
  balance: any
) {
  const balanceType = balance.balanceType || 'closingBooked';
  const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
  
  return {
    userId, // Plaintext - needed for queries
    balanceType, // Plaintext - needed for queries
    referenceDate, // Plaintext - needed for queries and sorting
    
    // Encrypted queryable field (deterministic - needed for account lookups)
    accountId: await encryptQueryable(accountId),
    
    // Encrypted sensitive fields
    balanceAmount: await encryptRandom(balance.balanceAmount?.amount || '0'),
    currency: await encryptRandom(balance.balanceAmount?.currency || 'EUR'),
    
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to encrypt transaction fields
 */
export async function encryptTransactionFields(
  userId: string,
  accountId: string,
  transaction: any,
  category: string
) {
  const txDescription = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  const counterparty = transaction.creditorName || transaction.debtorName || '';
  const providerTransactionId = transaction.transactionId || transaction.internalTransactionId || '';
  
  return {
    userId, // Plaintext - needed for queries
    category, // Plaintext - needed for queries and categorization
    exclude: false, // Plaintext - needed for queries
    bookingDate: transaction.bookingDate ? String(transaction.bookingDate).slice(0, 10) : null, // Plaintext - needed for sorting/filtering
    
    // Encrypted queryable field (deterministic - needed for account lookups)
    accountId: await encryptQueryable(accountId),
    
    // Encrypted queryable fields (deterministic - needed for lookups)
    transactionId: await encryptQueryable(providerTransactionId),
    
    // Encrypted sensitive fields (random - maximum security)
    amount: await encryptRandom(transaction.transactionAmount?.amount !== undefined ? String(transaction.transactionAmount.amount) : null),
    currency: await encryptRandom(transaction.transactionAmount?.currency?.toString().toUpperCase().slice(0, 3)),
    bookingDateTime: await encryptRandom(transaction.bookingDateTime ? String(transaction.bookingDateTime).slice(0, 25) : null),
    valueDate: await encryptRandom(transaction.valueDate ? String(transaction.valueDate).slice(0, 10) : null),
    description: await encryptRandom(txDescription ? txDescription.toString().slice(0, 500) : null),
    counterparty: await encryptRandom(counterparty ? counterparty.toString().slice(0, 255) : null),
    raw: await encryptRandom(JSON.stringify(transaction).slice(0, 10000)),
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to encrypt transaction update fields (for PATCH operations)
 */
export async function encryptTransactionUpdateFields(updatePayload: Record<string, any>) {
  const encrypted: Record<string, any> = {};
  
  // Only encrypt fields that are being updated and are sensitive
  if ('category' in updatePayload) {
    encrypted.category = updatePayload.category; // Plaintext - needed for queries
  }
  
  if ('exclude' in updatePayload) {
    encrypted.exclude = updatePayload.exclude; // Plaintext - needed for queries
  }
  
  if ('counterparty' in updatePayload) {
    encrypted.counterparty = await encryptRandom(updatePayload.counterparty);
  }
  
  if ('description' in updatePayload) {
    encrypted.description = await encryptRandom(updatePayload.description);
  }
  
  return encrypted;
}

