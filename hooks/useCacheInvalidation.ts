/**
 * React hook for cache invalidation
 * Provides an easy way to invalidate caches from any component
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
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
   * Invalidate only client-side React Query caches
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
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateAllCaches(queryClient, options);
    },
    [queryClient]
  );

  const invalidateServer = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateServerCache(options);
    },
    []
  );

  const invalidateClient = useCallback(
    async (options?: CacheInvalidationOptions) => {
      return await invalidateClientCache(queryClient, options);
    },
    [queryClient]
  );

  const invalidateAfterBankConnection = useCallback(
    async () => {
      return await invalidateAllCaches(queryClient, {
        scope: 'all',
        reason: 'bank-connection',
        silent: false,
      });
    },
    [queryClient]
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
