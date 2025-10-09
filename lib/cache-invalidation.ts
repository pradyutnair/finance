/**
 * Centralized cache invalidation utilities
 * Coordinates both server-side (API) and client-side (Zustand store) cache clearing
 */

// Custom event for cache invalidation
export const CACHE_INVALIDATION_EVENT = 'nexpass:cache-invalidate';

export type CacheInvalidationScope = 'all' | 'transactions' | 'accounts' | 'balances' | 'budgets' | 'categories' | 'metrics';

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
 * Invalidate Zustand store caches on the client
 */
export async function invalidateClientCache(
  options: CacheInvalidationOptions = {}
): Promise<boolean> {
  const { scope = 'all', reason = 'manual', silent = false } = options;
  
  try {
    if (!silent) {
      console.log(`[Cache] Invalidating client cache (scope: ${scope}, reason: ${reason})`);
    }

    // Import Zustand stores dynamically to avoid circular dependencies
    const { useTransactionsStore } = await import('@/lib/stores/transactions-store');
    const { useCategoriesStore } = await import('@/lib/stores/categories-store');
    const { useAccountsStore } = await import('@/lib/stores/accounts-store');
    const { useMetricsStore } = await import('@/lib/stores/metrics-store');

    // Invalidate based on scope
    switch (scope) {
      case 'all':
        // Invalidate all Zustand stores
        useTransactionsStore.getState().invalidate();
        useCategoriesStore.getState().invalidate();
        useAccountsStore.getState().invalidate();
        useMetricsStore.getState().invalidate();
        
        // Clear Zustand localStorage items
        if (typeof window !== 'undefined') {
          const keysToRemove = [
            'nexpass-transactions-storage',
            'nexpass-categories-storage',
            'nexpass-accounts-storage',
            'nexpass-metrics-storage',
          ];
          keysToRemove.forEach(key => {
            try {
              window.localStorage.removeItem(key);
            } catch (e) {
              console.warn(`Failed to remove ${key}`, e);
            }
          });
        }
        break;
        
      case 'transactions':
        useTransactionsStore.getState().invalidate();
        useMetricsStore.getState().invalidate();
        useCategoriesStore.getState().invalidate();
        break;
        
      case 'accounts':
        useAccountsStore.getState().invalidate();
        useTransactionsStore.getState().invalidate();
        break;
        
      case 'balances':
        useAccountsStore.getState().invalidate();
        useMetricsStore.getState().invalidate();
        break;
        
      case 'budgets':
        // Budgets don't have a dedicated store yet
        useMetricsStore.getState().invalidate();
        break;
        
      case 'categories':
        useCategoriesStore.getState().invalidate();
        break;
        
      case 'metrics':
        useMetricsStore.getState().invalidate();
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
  options: CacheInvalidationOptions = {}
): Promise<{ server: boolean; client: boolean; overall: boolean }> {
  const { scope = 'all', reason = 'manual', silent = false } = options;
  
  if (!silent) {
    console.log(`[Cache] Invalidating all caches (scope: ${scope}, reason: ${reason})`);
  }

  // Invalidate in parallel, but don't let one failure block the other
  const [serverSuccess, clientSuccess] = await Promise.all([
    invalidateServerCache({ scope, reason, silent }),
    invalidateClientCache({ scope, reason, silent }),
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
