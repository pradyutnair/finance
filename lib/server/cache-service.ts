/**
 * Centralized cache service for transaction data
 * Loads 365 days of transactions once and serves all requests from memory
 * Now supports encrypted data via transactions_public and transactions_enc tables
 */

import 'server-only';
import { Client, Databases, Query } from 'appwrite';
import { readEncrypted, EncryptionRouteConfig } from '@/lib/http/withEncryption';
import { isEncryptionEnabled } from './encryption-service';

type TransactionDoc = {
  $id?: string;
  userId?: string;
  accountId?: string;
  amount?: string | number;
  currency?: string;
  bookingDate?: string;
  valueDate?: string;
  description?: string;
  counterparty?: string;
  category?: string;
  exclude?: boolean;
  $createdAt?: string;
};

type UserCache = {
  transactions: TransactionDoc[];
  fromDate: string;
  toDate: string;
  lastFetched: number;
  isLoading: boolean;
};

type BalanceDoc = {
  $id?: string;
  userId?: string;
  accountId?: string;
  balanceAmount?: string | number;
  currency?: string;
  balanceType?: string;
  referenceDate?: string;
};

// Global in-memory cache
const globalAny = globalThis as any;
globalAny.__user_cache = globalAny.__user_cache || new Map<string, UserCache>();
globalAny.__balance_cache = globalAny.__balance_cache || new Map<string, BalanceDoc[]>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_DAYS = 365;

// Date utilities
const msDay = 24 * 60 * 60 * 1000;
const ymd = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const da = `${d.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${da}`;
};

/**
 * Get or load user's transaction cache (365 days)
 * Supports both encrypted and legacy unencrypted collections
 */
export async function getUserTransactionCache(
  userId: string,
  databases: Databases,
  forceRefresh = false
): Promise<TransactionDoc[]> {
  const cache: Map<string, UserCache> = globalAny.__user_cache;
  const now = Date.now();
  const cached = cache.get(userId);

  // Return cached data if valid and not forcing refresh
  if (cached && !forceRefresh && (now - cached.lastFetched < CACHE_TTL_MS)) {
    // Wait if another request is loading
    if (cached.isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return getUserTransactionCache(userId, databases, false);
    }
    return cached.transactions;
  }

  // Check if another request is already loading
  if (cached?.isLoading) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getUserTransactionCache(userId, databases, false);
  }

  // Mark as loading
  if (cached) {
    cached.isLoading = true;
  } else {
    cache.set(userId, {
      transactions: [],
      fromDate: '',
      toDate: '',
      lastFetched: 0,
      isLoading: true
    });
  }

  try {
    // Calculate date range (365 days from today)
    const toDate = ymd(new Date());
    const fromDate = ymd(new Date(Date.now() - (DEFAULT_DAYS - 1) * msDay));

    console.log(`[Cache] Loading ${DEFAULT_DAYS} days of transactions for user ${userId}: ${fromDate} to ${toDate}`);

    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
    
    // Check if encryption is enabled
    const useEncryption = isEncryptionEnabled();
    
    let allTransactions: TransactionDoc[] = [];

    if (useEncryption) {
      console.log('[Cache] Using encrypted collections (transactions_enc only)');
      const TRANSACTIONS_ENC_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc';

      // Fetch encrypted records with pagination
      let cursor: string | undefined;
      const pageSize = 100;
      
      while (true) {
        const queries = [
          Query.equal('userId', userId),
          Query.limit(pageSize)
        ];
        
        if (cursor) {
          queries.push(Query.cursorAfter(cursor));
        }

        const response = await databases.listDocuments(
          DATABASE_ID,
          TRANSACTIONS_ENC_COLLECTION_ID,
          queries
        );

        const docs = response.documents;
        
        // Decrypt each transaction in parallel
        const decryptedBatch = await Promise.allSettled(
          docs.map(async (doc: any) => {
            try {
              const config: EncryptionRouteConfig = {
                databases,
                databaseId: DATABASE_ID,
                encryptedCollectionId: TRANSACTIONS_ENC_COLLECTION_ID,
                userId,
              };
              
              const decrypted = await readEncrypted(doc.record_id || doc.$id, config);
              return {
                $id: doc.$id,
                ...decrypted,
              };
            } catch (err) {
              console.error(`[Cache] Failed to decrypt transaction ${doc.record_id}:`, err);
              return null;
            }
          })
        );

        const successfulDecrypts = decryptedBatch
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && result.value !== null)
          .map(result => result.value);
        
        allTransactions.push(...successfulDecrypts);

        if (docs.length < pageSize) break;
        cursor = docs[docs.length - 1].$id;
        if (!cursor) break;
      }

      // Filter by date range after decryption
      allTransactions = allTransactions.filter(t => {
        const date = t.bookingDate || t.valueDate || '';
        return date >= fromDate && date <= toDate;
      });
    } else {
      console.log('[Cache] Using legacy unencrypted collection');
      const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';
      
      // Fetch all transactions in the date range with pagination
      let cursor: string | undefined;
      const pageSize = 100;
      
      while (true) {
        const queries = [
          Query.equal('userId', userId),
          Query.greaterThanEqual('bookingDate', fromDate),
          Query.lessThanEqual('bookingDate', toDate),
          Query.orderDesc('bookingDate'),
          Query.limit(pageSize)
        ];
        
        if (cursor) {
          queries.push(Query.cursorAfter(cursor));
        }

        const response = await databases.listDocuments(
          DATABASE_ID,
          TRANSACTIONS_COLLECTION_ID,
          queries
        );

        const docs = response.documents as TransactionDoc[];
        allTransactions.push(...docs);

        if (docs.length < pageSize) break;
        cursor = docs[docs.length - 1].$id;
        if (!cursor) break;
      }
    }

    console.log(`[Cache] Loaded ${allTransactions.length} transactions for user ${userId}`);

    // Update cache
    cache.set(userId, {
      transactions: allTransactions,
      fromDate,
      toDate,
      lastFetched: now,
      isLoading: false
    });

    return allTransactions;
  } catch (error) {
    console.error('[Cache] Error loading transactions:', error);
    // Mark as not loading on error
    const errorCache = cache.get(userId);
    if (errorCache) {
      errorCache.isLoading = false;
    }
    throw error;
  }
}

/**
 * Filter cached transactions by date range and other criteria
 */
export function filterTransactions(
  transactions: TransactionDoc[],
  options: {
    from?: string | null;
    to?: string | null;
    accountId?: string | null;
    excludeExcluded?: boolean;
    category?: string | null;
    search?: string | null;
  } = {}
): TransactionDoc[] {
  let filtered = [...transactions];

  // Apply date range filter
  if (options.from) {
    filtered = filtered.filter(t => {
      const date = t.bookingDate || t.valueDate || '';
      return date >= options.from!;
    });
  }

  if (options.to) {
    filtered = filtered.filter(t => {
      const date = t.bookingDate || t.valueDate || '';
      return date <= options.to!;
    });
  }

  // Apply account filter
  if (options.accountId) {
    filtered = filtered.filter(t => t.accountId === options.accountId);
  }

  // Apply exclude filter
  if (options.excludeExcluded) {
    filtered = filtered.filter(t => !t.exclude);
  }

  // Apply category filter
  if (options.category) {
    filtered = filtered.filter(t => t.category === options.category);
  }

  // Apply search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    filtered = filtered.filter(t => {
      const text = `${t.description || ''} ${t.counterparty || ''}`.toLowerCase();
      return text.includes(searchLower);
    });
  }

  return filtered;
}

/**
 * Get or load user's balance cache
 */
export async function getUserBalanceCache(
  userId: string,
  databases: Databases,
  forceRefresh = false
): Promise<BalanceDoc[]> {
  const cache: Map<string, BalanceDoc[]> = globalAny.__balance_cache;
  const cached = cache.get(userId);

  if (cached && !forceRefresh) {
    return cached;
  }

  try {
    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
    const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

    // Fetch all balances for the user
    const allBalances: BalanceDoc[] = [];
    let cursor: string | undefined;
    const pageSize = 100;

    while (true) {
      const queries = [
        Query.equal('userId', userId),
        Query.orderDesc('referenceDate'),
        Query.limit(pageSize)
      ];

      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const response = await databases.listDocuments(
        DATABASE_ID,
        BALANCES_COLLECTION_ID,
        queries
      );

      const docs = response.documents as BalanceDoc[];
      allBalances.push(...docs);

      if (docs.length < pageSize) break;
      cursor = docs[docs.length - 1].$id;
      if (!cursor) break;
    }

    console.log(`[Cache] Loaded ${allBalances.length} balances for user ${userId}`);
    cache.set(userId, allBalances);
    return allBalances;
  } catch (error) {
    console.error('[Cache] Error loading balances:', error);
    throw error;
  }
}

/**
 * Invalidate user cache (call after updates)
 */
export function invalidateUserCache(userId: string, type: 'transactions' | 'balances' | 'all' = 'all') {
  if (type === 'transactions' || type === 'all') {
    const txCache: Map<string, UserCache> = globalAny.__user_cache;
    txCache.delete(userId);
  }
  
  if (type === 'balances' || type === 'all') {
    const balCache: Map<string, BalanceDoc[]> = globalAny.__balance_cache;
    balCache.delete(userId);
  }
}

/**
 * Preload cache for a user (call on app init)
 */
export async function preloadUserCache(userId: string, databases: Databases) {
  console.log(`[Cache] Preloading data for user ${userId}`);
  
  // Load transactions and balances in parallel
  await Promise.all([
    getUserTransactionCache(userId, databases, true),
    getUserBalanceCache(userId, databases, true)
  ]);
  
  console.log(`[Cache] Preload complete for user ${userId}`);
}

