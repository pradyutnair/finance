'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthHeader } from '@/lib/api';

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  category?: string;
  amount: number;
  currency: string;
  accountId: string;
  exclude?: boolean;
  counterparty?: string;
  bookingDate?: string;
  $id?: string;
}

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  total: number;
  lastFetch: number | null;
  params: any;
  
  setTransactions: (transactions: Transaction[], total: number, params?: any) => void;
  setLoading: (loading: boolean) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  fetchTransactions: (params?: {
    limit?: number;
    offset?: number;
    all?: boolean;
    category?: string;
    accountId?: string;
    dateRange?: { from: string; to: string };
    includeExcluded?: boolean;
  }) => Promise<void>;
  updateTransactionApi: (args: {
    id: string;
    category?: string;
    exclude?: boolean;
    description?: string;
    counterparty?: string;
    similarTransactionIds?: string[];
  }) => Promise<void>;
  autoCategorize: (args?: { limit?: number }) => Promise<{ ok: boolean; execution?: any }>;
  invalidate: () => void;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useTransactionsStore = create<TransactionsState>()(
  persist(
    (set, get) => ({
      transactions: [],
      loading: false,
      total: 0,
      lastFetch: null,
      params: null,

      setTransactions: (transactions, total, params) => {
        set({ 
          transactions, 
          total, 
          lastFetch: Date.now(),
          params: params || null,
          loading: false 
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      updateTransaction: (id, updates) => {
        set((state) => ({
          transactions: state.transactions.map((t) =>
            (t.$id || t.id) === id ? { ...t, ...updates } : t
          ),
        }));
      },

      fetchTransactions: async (params) => {
        const state = get();
        
        // Check cache validity
        const now = Date.now();
        const paramsKey = JSON.stringify(params || {});
        const cachedParamsKey = JSON.stringify(state.params || {});
        
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_TTL &&
          paramsKey === cachedParamsKey &&
          state.transactions.length > 0
        ) {
          console.log('[TransactionsStore] Using cached data');
          return;
        }

        set({ loading: true });

        try {
          const searchParams = new URLSearchParams();
          if (params?.limit) searchParams.set('limit', params.limit.toString());
          if (params?.offset) searchParams.set('offset', params.offset.toString());
          if (params?.all) searchParams.set('all', 'true');
          if (params?.category) searchParams.set('category', params.category);
          if (params?.accountId) searchParams.set('accountId', params.accountId);
          if (params?.dateRange?.from) searchParams.set('from', params.dateRange.from);
          if (params?.dateRange?.to) searchParams.set('to', params.dateRange.to);
          if (params?.includeExcluded) searchParams.set('includeExcluded', 'true');

          const authHeader = await getAuthHeader();
          const response = await fetch(`/api/transactions?${searchParams.toString()}`, {
            headers: {
              'Content-Type': 'application/json',
              ...authHeader,
            },
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          set({
            transactions: data.transactions || [],
            total: data.total || 0,
            lastFetch: Date.now(),
            params,
            loading: false,
          });
        } catch (error) {
          console.error('[TransactionsStore] Fetch error:', error);
          set({ loading: false });
        }
      },

      updateTransactionApi: async (args) => {
        try {
          const authHeader = await getAuthHeader();
          const response = await fetch(`/api/transactions/${args.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader,
            },
            credentials: 'include',
            body: JSON.stringify({
              category: args.category,
              exclude: args.exclude,
              description: args.description,
              counterparty: args.counterparty,
              similarTransactionIds: args.similarTransactionIds,
            }),
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          // Optimistically update the transaction
          const normalize = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
          const matchDesc = normalize(args.description);
          const matchCp = normalize(args.counterparty);

          set((state) => ({
            transactions: state.transactions.map((t) => {
              const isTarget = (t.$id || t.id) === args.id;
              if (isTarget) {
                return {
                  ...t,
                  ...(typeof args.category === 'string' ? { category: args.category } : {}),
                  ...(typeof args.exclude === 'boolean' ? { exclude: args.exclude } : {}),
                  ...(typeof args.counterparty === 'string' ? { counterparty: args.counterparty } : {}),
                  ...(typeof args.description === 'string' ? { description: args.description } : {}),
                };
              }

              // Optimistically update similar transactions when changing category
              if (typeof args.category === 'string' && (matchDesc || matchCp)) {
                const tDesc = normalize((t as any).description);
                const tCp = normalize((t as any).counterparty);
                const same = (matchDesc && tDesc === matchDesc) || (matchCp && tCp === matchCp);
                if (same) {
                  return { ...t, category: args.category };
                }
              }
              return t;
            }),
          }));

          // Invalidate categories cache after transaction update
          // Using setTimeout to avoid import issues during build
          setTimeout(() => {
            try {
              const { useCategoriesStore } = require('./categories-store');
              useCategoriesStore.getState().invalidate();
            } catch (e) {
              // Categories store not available yet
            }
          }, 0);
        } catch (error) {
          console.error('[TransactionsStore] Update error:', error);
          throw error;
        }
      },

      autoCategorize: async (args) => {
        try {
          const authHeader = await getAuthHeader();
          const response = await fetch('/api/transactions/auto-categorize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader,
            },
            credentials: 'include',
            body: JSON.stringify({ limit: args?.limit ?? 200 }),
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();

          // Invalidate transactions and categories cache after categorization
          set({ lastFetch: null });
          setTimeout(() => {
            try {
              const { useCategoriesStore } = require('./categories-store');
              useCategoriesStore.getState().invalidate();
            } catch (e) {
              // Categories store not available yet
            }
          }, 0);

          return result;
        } catch (error) {
          console.error('[TransactionsStore] Auto-categorize error:', error);
          throw error;
        }
      },

      invalidate: () => {
        set({ lastFetch: null });
      },
    }),
    {
      name: 'nexpass-transactions-storage',
      partialize: (state) => ({
        transactions: state.transactions,
        total: state.total,
        lastFetch: state.lastFetch,
        params: state.params,
      }),
    }
  )
);
