/**
 * React hook for cache invalidation
 * Provides an easy way to invalidate caches from any component
 * Updated to work with Zustand stores instead of React Query
 */

'use client';

import { useCallback, useEffect } from 'react';
import {
  invalidateAllCaches,
  invalidateClientCache,
  invalidateServerCache,
  onCacheInvalidation,
  type CacheInvalidationOptions,
  type CacheInvalidationScope,
} from '@/lib/cache-invalidation';

export interface UseCacheInvalidationResult {
  /**
   * Invalidate both server and client caches
   * Returns object with success status for each cache type
   */
  invalidateAll: (options?: CacheInvalidationOptions) => Promise<{ server: boolean; client: boolean; overall: boolean }>;
  
  /**
   * Invalidate only server-side caches
   * Returns true if successful, false otherwise
   */
  invalidateServer: (options?: CacheInvalidationOptions) => Promise<boolean>;
  
  /**
   * Invalidate only client-side Zustand store caches
   * Returns true if successful, false otherwise
   */
  invalidateClient: (options?: CacheInvalidationOptions) => Promise<boolean>;
  
  /**
   * Convenience method for invalidating after bank connection
   * Returns object with success status for each cache type
   */
  invalidateAfterBankConnection: () => Promise<{ server: boolean; client: boolean; overall: boolean }>;
}

export function useCacheInvalidation(): UseCacheInvalidationResult {
  const invalidateAll = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateAllCaches(options);
    },
    []
  );

  const invalidateServer = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateServerCache(options);
    },
    []
  );

  const invalidateClient = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateClientCache(options);
    },
    []
  );

  const invalidateAfterBankConnection = useCallback(
    async () => {
      return await invalidateAllCaches({
        scope: 'all',
        reason: 'bank-connection',
        silent: false,
      });
    },
    []
  );

  return {
    invalidateAll,
    invalidateServer,
    invalidateClient,
    invalidateAfterBankConnection,
  };
}

/**
 * Hook to listen for cache invalidation events
 * Useful for components that need to react to cache changes
 */
export function useCacheInvalidationListener(
  callback: (scope: CacheInvalidationScope, reason: string) => void
) {
  useEffect(() => {
    const unsubscribe = onCacheInvalidation((detail) => {
      callback(detail.scope, detail.reason);
    });

    return unsubscribe;
  }, [callback]);
}
