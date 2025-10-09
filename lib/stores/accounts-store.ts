'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthHeader } from '@/lib/api';

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  status: string;
  lastSync: string;
}

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  lastFetch: number | null;
  
  setAccounts: (accounts: Account[]) => void;
  setLoading: (loading: boolean) => void;
  fetchAccounts: () => Promise<void>;
  createRequisition: (data: {
    institutionId: string;
    redirect: string;
    reference?: string;
    userLanguage?: string;
  }) => Promise<any>;
  invalidate: () => void;
}

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export const useAccountsStore = create<AccountsState>()(
  persist(
    (set, get) => ({
      accounts: [],
      loading: false,
      lastFetch: null,

      setAccounts: (accounts) => {
        set({ 
          accounts, 
          lastFetch: Date.now(),
          loading: false 
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      fetchAccounts: async () => {
        const state = get();
        
        // Check cache validity
        const now = Date.now();
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_TTL &&
          state.accounts.length > 0
        ) {
          console.log('[AccountsStore] Using cached data');
          return;
        }

        set({ loading: true });

        try {
          const authHeader = await getAuthHeader();
          const response = await fetch('/api/accounts', {
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
          const accounts = Array.isArray((data as any).accounts) ? (data as any).accounts : [];
          
          set({
            accounts,
            lastFetch: Date.now(),
            loading: false,
          });
        } catch (error) {
          console.error('[AccountsStore] Fetch error:', error);
          set({ loading: false });
        }
      },

      createRequisition: async (data) => {
        try {
          const authHeader = await getAuthHeader();
          const response = await fetch('/api/gocardless/requisitions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader,
            },
            credentials: 'include',
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          
          // Invalidate accounts cache after creating requisition
          set({ lastFetch: null });
          
          return result;
        } catch (error) {
          console.error('[AccountsStore] Create requisition error:', error);
          throw error;
        }
      },

      invalidate: () => {
        set({ lastFetch: null });
      },
    }),
    {
      name: 'nexpass-accounts-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        lastFetch: state.lastFetch,
      }),
    }
  )
);
