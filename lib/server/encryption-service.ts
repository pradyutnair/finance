import 'server-only';
import { Databases, Query } from 'appwrite';
import { writeEncrypted, readEncrypted, queryAndDecrypt, EncryptionRouteConfig } from '@/lib/http/withEncryption';
import {
  toPublicTransaction,
  toSensitiveTransaction,
  toPublicBankAccount,
  toSensitiveBankAccount,
  toPublicBankBalance,
  toSensitiveBankBalance,
  toPublicBankConnection,
  toSensitiveBankConnection,
  toPublicRequisition,
  toSensitiveRequisition,
  mergeTransactionData,
  mergeBankAccountData,
  mergeBankBalanceData,
  mergeBankConnectionData,
  mergeRequisitionData,
} from '@/lib/gocardless/adapters';

/**
 * Service layer for encrypted data operations.
 * Provides high-level methods for storing and retrieving encrypted financial data.
 */

interface StoreTransactionParams {
  gcTransaction: any;
  userId: string;
  accountId: string;
  category?: string;
  databases: Databases;
  databaseId: string;
}

/**
 * Store a transaction with encryption.
 * ALL transaction data is encrypted - no public table.
 */
export async function storeEncryptedTransaction(params: StoreTransactionParams): Promise<string> {
  const { gcTransaction, userId, accountId, category, databases, databaseId } = params;

  // Get public and sensitive data
  const publicData = toPublicTransaction(gcTransaction, userId, accountId);
  if (category) {
    publicData.category = category;
  }

  const sensitiveData = toSensitiveTransaction(gcTransaction);

  // Combine everything - ALL fields are encrypted
  const fullData = {
    ...publicData,
    ...sensitiveData,
  };

  // Store encrypted (no public collection for transactions)
  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc',
    userId,
  };

  const result = await writeEncrypted({}, fullData, config, publicData.transactionId);
  return result.recordId;
}

interface StoreAccountParams {
  gcAccount: any;
  userId: string;
  accountId: string;
  institutionId: string;
  institutionName?: string;
  databases: Databases;
  databaseId: string;
}

/**
 * Store a bank account with encryption.
 */
export async function storeEncryptedBankAccount(params: StoreAccountParams): Promise<string> {
  const { gcAccount, userId, accountId, institutionId, institutionName, databases, databaseId } = params;

  // For bank accounts, we don't need a separate public table since the existing
  // bank_accounts_dev table already has the queryable fields
  // We'll just add an encrypted companion table

  // Store public metadata in existing bank_accounts_dev
  // and encrypted sensitive data in bank_accounts_enc

  const publicData = toPublicBankAccount(gcAccount, userId, accountId, institutionId, institutionName);
  const sensitiveData = toSensitiveBankAccount(gcAccount);

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: process.env.APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID || 'bank_accounts_enc',
    userId,
  };

  const result = await writeEncrypted({}, sensitiveData, config, accountId);
  return result.recordId;
}

interface StoreBalanceParams {
  gcBalance: any;
  userId: string;
  accountId: string;
  databases: Databases;
  databaseId: string;
}

/**
 * Store a balance with encryption.
 */
export async function storeEncryptedBalance(params: StoreBalanceParams): Promise<string> {
  const { gcBalance, userId, accountId, databases, databaseId } = params;

  const publicData = toPublicBankBalance(gcBalance, userId, accountId);
  const sensitiveData = toSensitiveBankBalance(gcBalance);

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: process.env.APPWRITE_BANK_BALANCES_ENC_COLLECTION_ID || 'bank_balances_enc',
    userId,
  };

  const result = await writeEncrypted(publicData, sensitiveData, config);
  return result.recordId;
}

interface StoreConnectionParams {
  requisition: any;
  userId: string;
  institutionMetadata?: {
    logoUrl?: string;
    transactionTotalDays?: number;
    maxAccessValidForDays?: number;
  };
  databases: Databases;
  databaseId: string;
}

/**
 * Store a bank connection with encryption.
 */
export async function storeEncryptedBankConnection(params: StoreConnectionParams): Promise<string> {
  const { requisition, userId, institutionMetadata, databases, databaseId } = params;

  const publicData = toPublicBankConnection(requisition, userId, institutionMetadata);
  const sensitiveData = toSensitiveBankConnection(requisition);

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: process.env.APPWRITE_BANK_CONNECTIONS_ENC_COLLECTION_ID || 'bank_connections_enc',
    userId,
  };

  const result = await writeEncrypted(publicData, sensitiveData, config);
  return result.recordId;
}

interface StoreRequisitionParams {
  requisition: any;
  userId: string;
  databases: Databases;
  databaseId: string;
}

/**
 * Store a requisition with encryption.
 */
export async function storeEncryptedRequisition(params: StoreRequisitionParams): Promise<string> {
  const { requisition, userId, databases, databaseId } = params;

  const publicData = toPublicRequisition(requisition, userId);
  const sensitiveData = toSensitiveRequisition(requisition);

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: process.env.APPWRITE_REQUISITIONS_ENC_COLLECTION_ID || 'requisitions_enc',
    userId,
  };

  const result = await writeEncrypted(publicData, sensitiveData, config, requisition.id);
  return result.recordId;
}

interface GetTransactionParams {
  transactionId: string;
  userId: string;
  databases: Databases;
  databaseId: string;
}

/**
 * Get a transaction with decryption.
 */
export async function getEncryptedTransaction(params: GetTransactionParams): Promise<any> {
  const { transactionId, userId, databases, databaseId } = params;

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    publicCollectionId: process.env.APPWRITE_TRANSACTIONS_PUBLIC_COLLECTION_ID || 'transactions_public',
    encryptedCollectionId: process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc',
    userId,
  };

  const data = await readEncrypted(transactionId, config);
  return data;
}

interface QueryTransactionsParams {
  userId: string;
  accountId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  databases: Databases;
  databaseId: string;
}

/**
 * Query transactions with decryption.
 * Queries transactions_enc directly since all data is encrypted.
 */
export async function queryEncryptedTransactions(params: QueryTransactionsParams): Promise<any[]> {
  const { userId, accountId, from, to, limit = 50, offset = 0, databases, databaseId } = params;

  const TRANSACTIONS_ENC_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc';

  const queries: string[] = [Query.equal('userId', userId)];
  
  queries.push(Query.limit(limit));
  queries.push(Query.offset(offset));

  // Fetch encrypted records
  const response = await databases.listDocuments(
    databaseId,
    TRANSACTIONS_ENC_COLLECTION_ID,
    queries
  );

  const config: EncryptionRouteConfig = {
    databases,
    databaseId,
    encryptedCollectionId: TRANSACTIONS_ENC_COLLECTION_ID,
    userId,
  };

  // Decrypt all records in parallel
  const decryptedResults = await Promise.allSettled(
    response.documents.map(async (doc: any) => {
      try {
        const decrypted = await readEncrypted(doc.record_id, config);
        return decrypted;
      } catch (err) {
        console.error(`Failed to decrypt transaction ${doc.record_id}:`, err);
        return null;
      }
    })
  );

  // Filter successful decryptions and apply filters
  let results = decryptedResults
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && result.value !== null)
    .map(result => result.value);

  // Apply filters on decrypted data
  if (accountId) {
    results = results.filter(t => t.accountId === accountId);
  }
  
  if (from) {
    results = results.filter(t => {
      const date = t.bookingDate || t.valueDate || '';
      return date >= from;
    });
  }
  
  if (to) {
    results = results.filter(t => {
      const date = t.bookingDate || t.valueDate || '';
      return date <= to;
    });
  }

  // Sort by booking date descending
  results.sort((a, b) => {
    const dateA = a.bookingDate || a.valueDate || '';
    const dateB = b.bookingDate || b.valueDate || '';
    return dateB.localeCompare(dateA);
  });

  return results;
}

/**
 * Check if encryption is enabled (based on environment variables).
 */
export function isEncryptionEnabled(): boolean {
  return !!(
    process.env.ENCRYPTION_PROVIDER &&
    (process.env.AWS_KMS_KEY_ARN || process.env.GCP_KMS_KEY_URI) &&
    process.env.INDEX_KEY_MERCHANT &&
    process.env.INDEX_KEY_DESC
  );
}

/**
 * Get the appropriate collection IDs based on encryption status.
 * Falls back to _dev collections if encryption is not enabled.
 */
export function getCollectionIds() {
  const useEncryption = isEncryptionEnabled();

  return {
    transactions: useEncryption
      ? process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc'
      : process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev',
    transactionsEnc: process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc',
    bankAccounts: process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev',
    bankAccountsEnc: process.env.APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID || 'bank_accounts_enc',
    balances: process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev',
    balancesEnc: process.env.APPWRITE_BANK_BALANCES_ENC_COLLECTION_ID || 'bank_balances_enc',
    bankConnections: process.env.APPWRITE_BANK_CONNECTIONS_COLLECTION_ID || 'bank_connections_dev',
    bankConnectionsEnc: process.env.APPWRITE_BANK_CONNECTIONS_ENC_COLLECTION_ID || 'bank_connections_enc',
    requisitions: process.env.APPWRITE_REQUISITIONS_COLLECTION_ID || 'requisitions_dev',
    requisitionsEnc: process.env.APPWRITE_REQUISITIONS_ENC_COLLECTION_ID || 'requisitions_enc',
  };
}
