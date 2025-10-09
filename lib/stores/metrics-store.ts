'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAuthHeader } from '@/lib/api';

export interface DashboardMetrics {
  balance: number;
  income: number;
  expenses: number;
  netIncome: number;
  savingsRate: number;
  transactionCount: number;
  deltas?: {
    balancePct: number;
    incomePct: number;
    expensesPct: number;
    savingsPct: number;
  };
}

export interface SeriesPoint {
  date: string;
  income: number;
  expenses: number;
}

interface MetricsState {
  metrics: DashboardMetrics | null;
  timeseries: SeriesPoint[];
  loading: boolean;
  lastFetch: number | null;
  params: any;
  
  setMetrics: (metrics: DashboardMetrics, params?: any) => void;
  setTimeseries: (timeseries: SeriesPoint[], params?: any) => void;
  setLoading: (loading: boolean) => void;
  fetchMetrics: (dateRange?: { from: string; to: string }) => Promise<void>;
  fetchTimeseries: (dateRange?: { from: string; to: string }) => Promise<void>;
  invalidate: () => void;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useMetricsStore = create<MetricsState>()(
  persist(
    (set, get) => ({
      metrics: null,
      timeseries: [],
      loading: false,
      lastFetch: null,
      params: null,

      setMetrics: (metrics, params) => {
        set({ 
          metrics, 
          lastFetch: Date.now(),
          params: params || null,
          loading: false 
        });
      },

      setTimeseries: (timeseries, params) => {
        set({ 
          timeseries, 
          lastFetch: Date.now(),
          params: params || null,
          loading: false 
        });
      },

      setLoading: (loading) => {
        set({ loading });
      },

      fetchMetrics: async (dateRange) => {
        const state = get();
        
        // Check cache validity
        const now = Date.now();
        const paramsKey = JSON.stringify(dateRange || {});
        const cachedParamsKey = JSON.stringify(state.params || {});
        
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_TTL &&
          paramsKey === cachedParamsKey &&
          state.metrics
        ) {
          console.log('[MetricsStore] Using cached data');
          return;
        }

        set({ loading: true });

        try {
          const searchParams = new URLSearchParams();
          if (dateRange?.from) searchParams.set('from', dateRange.from);
          if (dateRange?.to) searchParams.set('to', dateRange.to);

          const authHeader = await getAuthHeader();
          const response = await fetch(`/api/metrics?${searchParams.toString()}`, {
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
            metrics: data,
            lastFetch: Date.now(),
            params: dateRange,
            loading: false,
          });
        } catch (error) {
          console.error('[MetricsStore] Fetch error:', error);
          set({ loading: false });
        }
      },

      fetchTimeseries: async (dateRange) => {
        const state = get();
        
        // Check cache validity
        const now = Date.now();
        const paramsKey = JSON.stringify(dateRange || {});
        const cachedParamsKey = JSON.stringify(state.params || {});
        
        if (
          state.lastFetch &&
          now - state.lastFetch < CACHE_TTL &&
          paramsKey === cachedParamsKey &&
          state.timeseries.length > 0
        ) {
          console.log('[MetricsStore] Using cached timeseries data');
          return;
        }

        set({ loading: true });

        try {
          const searchParams = new URLSearchParams();
          if (dateRange?.from) searchParams.set('from', dateRange.from);
          if (dateRange?.to) searchParams.set('to', dateRange.to);

          const authHeader = await getAuthHeader();
          const response = await fetch(`/api/timeseries?${searchParams.toString()}`, {
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
            timeseries: Array.isArray(data) ? data : [],
            lastFetch: Date.now(),
            params: dateRange,
            loading: false,
          });
        } catch (error) {
          console.error('[MetricsStore] Fetch timeseries error:', error);
          set({ loading: false });
        }
      },

      invalidate: () => {
        set({ lastFetch: null });
      },
    }),
    {
      name: 'nexpass-metrics-storage',
      partialize: (state) => ({
        metrics: state.metrics,
        timeseries: state.timeseries,
        lastFetch: state.lastFetch,
        params: state.params,
      }),
    }
  )
);
