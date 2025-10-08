/**
 * Centralized cache invalidation utilities
 * Coordinates both server-side (API) and client-side (React Query) cache clearing
 */

import { QueryClient } from '@tanstack/react-query';

// Custom event for cache invalidation
export const CACHE_INVALIDATION_EVENT = 'nexpass:cache-invalidate';

export type CacheInvalidationScope = 'all' | 'transactions' | 'accounts' | 'balances' | 'budgets';

export interface CacheInvalidationOptions {
  scope?: CacheInvalidationScope;
  reason?: string;
  silent?: boolean;
}

/**
 * Invalidate server-side caches via API
 */
export async function invalidateServerCache(options: CacheInvalidationOptions = {}): Promise<boolean> {
  const { scope = 'all', reason = 'manual', silent = false } = options;
  
  try {
    if (!silent) {
      console.log(`[Cache] Invalidating server cache (scope: ${scope}, reason: ${reason})`);
    }
    
    const response = await fetch('/api/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ scope, reason }),
    });

    if (!response.ok) {
      console.error(`[Cache] Server cache invalidation failed: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    if (!silent) {
      console.log('[Cache] Server cache invalidated:', data);
    }
    
    return true;
  } catch (error) {
    console.error('[Cache] Failed to invalidate server cache:', error);
    return false;
  }
}

/**
 * Invalidate React Query caches on the client
 */
export async function invalidateClientCache(
  queryClient: QueryClient,
  options: CacheInvalidationOptions = {}
): Promise<boolean> {
  const { scope = 'all', reason = 'manual', silent = false } = options;
  
  try {
    if (!silent) {
      console.log(`[Cache] Invalidating client cache (scope: ${scope}, reason: ${reason})`);
    }

    // Invalidate based on scope
    switch (scope) {
      case 'all':
        await queryClient.invalidateQueries();
        queryClient.clear();
        // Clear localStorage cache
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('nexpass_rq_cache_v1');
        }
        break;
        
      case 'transactions':
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        await queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
        await queryClient.invalidateQueries({ queryKey: ['timeseries'] });
        await queryClient.invalidateQueries({ queryKey: ['metrics'] });
        break;
        
      case 'accounts':
        await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        await queryClient.invalidateQueries({ queryKey: ['account-details'] });
        await queryClient.invalidateQueries({ queryKey: ['requisition'] });
        break;
        
      case 'balances':
        await queryClient.invalidateQueries({ queryKey: ['accounts'] });
        await queryClient.invalidateQueries({ queryKey: ['metrics'] });
        break;
        
      case 'budgets':
        await queryClient.invalidateQueries({ queryKey: ['budgets'] });
        await queryClient.invalidateQueries({ queryKey: ['goals'] });
        break;
    }
    
    if (!silent) {
      console.log('[Cache] Client cache invalidated');
    }
    
    return true;
  } catch (error) {
    console.error('[Cache] Failed to invalidate client cache:', error);
    return false;
  }
}

/**
 * Invalidate both server and client caches
 * Returns an object indicating success/failure for each cache type
 */
export async function invalidateAllCaches(
  queryClient: QueryClient,
  options: CacheInvalidationOptions = {}
): Promise<{ server: boolean; client: boolean; overall: boolean }> {
  const { scope = 'all', reason = 'manual', silent = false } = options;
  
  if (!silent) {
    console.log(`[Cache] Invalidating all caches (scope: ${scope}, reason: ${reason})`);
  }

  // Invalidate in parallel, but don't let one failure block the other
  const [serverSuccess, clientSuccess] = await Promise.all([
    invalidateServerCache({ scope, reason, silent }),
    invalidateClientCache(queryClient, { scope, reason, silent }),
  ]);

  const overall = serverSuccess && clientSuccess;

  // Dispatch custom event for other components to listen (even on partial failure)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_INVALIDATION_EVENT, {
      detail: { scope, reason, timestamp: Date.now(), serverSuccess, clientSuccess }
    }));
  }
  
  if (!silent) {
    if (overall) {
      console.log('[Cache] All caches invalidated successfully');
    } else {
      console.warn('[Cache] Cache invalidation completed with errors', { serverSuccess, clientSuccess });
    }
  }
  
  return { server: serverSuccess, client: clientSuccess, overall };
}

/**
 * Listen for cache invalidation events
 */
export function onCacheInvalidation(
  callback: (detail: { scope: CacheInvalidationScope; reason: string; timestamp: number }) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener(CACHE_INVALIDATION_EVENT, handler);
  
  return () => {
    window.removeEventListener(CACHE_INVALIDATION_EVENT, handler);
  };
}
