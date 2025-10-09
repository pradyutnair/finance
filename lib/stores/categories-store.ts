'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthHeader } from '@/lib/api';

export interface CategorySlice {
  name: string;
  amount: number;
  percent: number;
}

interface CategoriesState {
  categories: CategorySlice[];
  loading: boolean;
  lastFetch: number | null;
  params: any;
  
  setCategories: (categories: CategorySlice[], params?: any) => void;
  setLoading: (loading: boolean) => void;
  fetchCategories: (dateRange?: { from: string; to: string }) => Promise<void>;
  invalidate: () => void;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,
      lastFetch: null,
      params: null,

      setCategories: (categories, params) => {
        set({ 
          categories, 
          lastFetch: Date.now(),
          params: params || null,
          loading: false 
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      fetchCategories: async (dateRange) => {
        const state = get();
        
        // Check cache validity
        const now = Date.now();
        const paramsKey = JSON.stringify(dateRange || {});
        const cachedParamsKey = JSON.stringify(state.params || {});
        
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_TTL &&
          paramsKey === cachedParamsKey &&
          state.categories.length > 0
        ) {
          console.log('[CategoriesStore] Using cached data');
          return;
        }

        set({ loading: true });

        try {
          const searchParams = new URLSearchParams();
          if (dateRange?.from) searchParams.set('from', dateRange.from);
          if (dateRange?.to) searchParams.set('to', dateRange.to);

          const authHeader = await getAuthHeader();
          const response = await fetch(`/api/categories?${searchParams.toString()}`, {
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
            categories: Array.isArray(data) ? data : [],
            lastFetch: Date.now(),
            params: dateRange,
            loading: false,
          });
        } catch (error) {
          console.error('[CategoriesStore] Fetch error:', error);
          set({ loading: false });
        }
      },

      invalidate: () => {
        set({ lastFetch: null });
      },
    }),
    {
      name: 'nexpass-categories-storage',
      partialize: (state) => ({
        categories: state.categories,
        lastFetch: state.lastFetch,
        params: state.params,
      }),
    }
  )
);
