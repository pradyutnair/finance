/**
 * Centralized cache service for transaction data
 * Loads 365 days of transactions once and serves all requests from memory
 * Now supports encrypted data via transactions_public and transactions_enc tables
 */

import 'server-only';
import { Client, Databases, Query } from 'appwrite';
import { getDb } from '@/lib/mongo/client';

type TransactionDoc = {
  $id?: string;
  userId?: string;
  accountId?: string;
  amount?: string | number;
  currency?: string;
  bookingDate?: string;
  valueDate?: string;
  authorizedDate?: string;
  bookingDateTime?: string;
  description?: string;
  counterparty?: string;
  category?: string;
  exclude?: boolean;
  pending?: boolean;
  paymentChannel?: string;
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    storeNumber?: string;
  };
  counterparties?: Array<{
    name: string;
    type: string;
    website?: string;
    logoUrl?: string;
    confidenceLevel?: string;
  }>;
  personalFinanceCategory?: {
    primary?: string;
    detailed?: string;
    confidenceLevel?: string;
  };
  merchantName?: string;
  logoUrl?: string;
  website?: string;
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
  forceRefresh = false,
  fetchAllTime = false
): Promise<TransactionDoc[]> {
  const cache: Map<string, UserCache> = globalAny.__user_cache;
  const now = Date.now();
  const cached = cache.get(userId);

  // Skip cache if fetching all time (cache is only for 365 days)
  if (!fetchAllTime) {
    // Return cached data if valid and not forcing refresh
    if (cached && !forceRefresh && (now - cached.lastFetched < CACHE_TTL_MS)) {
      // Wait if another request is loading
      if (cached.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return getUserTransactionCache(userId, databases, false, false);
      }
      return cached.transactions;
    }
  }

  // Check if another request is already loading (skip if fetching all time)
  if (!fetchAllTime && cached?.isLoading) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getUserTransactionCache(userId, databases, false, false);
  }

  // Mark as loading (skip if fetching all time, we don't cache that)
  if (!fetchAllTime) {
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
  }

  try {
    // Calculate date range (365 days from today, or all time if requested)
    const toDate = ymd(new Date());
    const fromDate = fetchAllTime ? '1900-01-01' : ymd(new Date(Date.now() - (DEFAULT_DAYS - 1) * msDay));

    console.log(`[Cache] Loading ${fetchAllTime ? 'ALL TIME' : DEFAULT_DAYS + ' days'} transactions for user ${userId}: ${fromDate} to ${toDate}`);

    let allTransactions: TransactionDoc[] = [];

    if (process.env.DATA_BACKEND === 'mongodb') {
      console.log('[Cache] Using MongoDB backend (transactions_plaid)');
      const db = await getDb();
      const coll = db.collection('transactions_plaid');
      const cursor = coll
        .find({ userId, bookingDate: { $gte: fromDate, $lte: toDate } })
        .sort({ bookingDate: -1 })
        .limit(fetchAllTime ? 100000 : 20000);
      const docs = await cursor.toArray();
      allTransactions = docs.map((d: any) => ({
        id: d.transactionId, // Use transactionId from Plaid as the primary ID
        userId: d.userId,
        accountId: d.accountId,
        amount: d.amount,
        currency: d.currency,
        bookingDate: d.bookingDate,
        valueDate: d.valueDate,
        authorizedDate: d.authorizedDate,
        bookingDateTime: d.bookingDateTime,
        description: d.description,
        counterparty: d.counterparty,
        category: d.category,
        exclude: d.exclude,
        pending: d.pending,
        paymentChannel: d.paymentChannel,
        location: d.location,
        counterparties: d.counterparties,
        personalFinanceCategory: d.personalFinanceCategory,
        merchantName: d.merchantName,
        logoUrl: d.logoUrl,
        website: d.website,
        $createdAt: d.createdAt,
      }));
    } else {
      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
      console.log('[Cache] Using legacy Appwrite unencrypted collection');
      const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_plaid';

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
        cursor = docs[docs.length - 1].id;
        if (!cursor) break;
      }
    }

    console.log(`[Cache] Loaded ${allTransactions.length} transactions for user ${userId}`);

    // Update cache only if not fetching all time
    if (!fetchAllTime) {
      cache.set(userId, {
        transactions: allTransactions,
        fromDate,
        toDate,
        lastFetched: now,
        isLoading: false
      });
    }

    return allTransactions;
  } catch (error) {
    console.error('[Cache] Error loading transactions:', error);
    // Mark as not loading on error (only if we were using cache)
    if (!fetchAllTime) {
      const errorCache = cache.get(userId);
      if (errorCache) {
        errorCache.isLoading = false;
      }
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
    let allBalances: BalanceDoc[] = [];

    if (process.env.DATA_BACKEND === 'mongodb') {
      const db = await getDb();
      const docs = await db
        .collection('balances_dev')
        .find({ userId })
        .sort({ referenceDate: -1 })
        .toArray();
      
      allBalances = docs.map((d: any) => ({
        id: d._id?.toString?.() || d._id,
        userId: d.userId,
        accountId: d.accountId,
        balanceAmount: d.balanceAmount,
        currency: d.currency,
        balanceType: d.balanceType,
        referenceDate: d.referenceDate,
      }));
    } else {
      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
      const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';

      // Fetch all balances for the user
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
        cursor = docs[docs.length - 1].id;
        if (!cursor) break;
      }
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
  console.log(`[Cache] Invalidating user cache for ${userId} (type: ${type})`);
  
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
 * Invalidate all user caches (for all users)
 * Use with caution - mainly for admin or testing purposes
 */
export function invalidateAllUserCaches() {
  console.log('[Cache] Invalidating all user caches');
  
  const txCache: Map<string, UserCache> = globalAny.__user_cache;
  const balCache: Map<string, BalanceDoc[]> = globalAny.__balance_cache;
  
  const txSize = txCache.size;
  const balSize = balCache.size;
  
  txCache.clear();
  balCache.clear();
  
  return {
    transactionsCleared: txSize,
    balancesCleared: balSize,
  };
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

