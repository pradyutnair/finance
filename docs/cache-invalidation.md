# Cache Invalidation System

This document explains the improved cache invalidation system that automatically refreshes data throughout the app when important events occur (like connecting a new bank account).

## Problem Solved

Previously, when a user connected a new bank account, they had to manually click a "Clear Cache" button to see the new data. This was bad UX and often led to confusion when accounts or transactions didn't appear immediately.

## Solution Overview

The new system provides:
1. **Automatic cache invalidation** when bank accounts are connected
2. **Coordinated clearing** of both server-side and client-side caches
3. **Event-based notifications** so all components can react to cache changes
4. **Granular control** over what gets invalidated (all, transactions, accounts, etc.)

## Architecture

### Core Components

1. **`/lib/cache-invalidation.ts`** - Centralized utilities for cache invalidation
   - `invalidateAllCaches()` - Clears both server and client caches
   - `invalidateServerCache()` - Clears server-side API caches
   - `invalidateClientCache()` - Clears React Query caches
   - `onCacheInvalidation()` - Event listener for cache changes

2. **`/hooks/useCacheInvalidation.ts`** - React hook for easy cache invalidation
   - `invalidateAll()` - Invalidate everything
   - `invalidateServer()` - Server-side only
   - `invalidateClient()` - Client-side only
   - `invalidateAfterBankConnection()` - Convenience method for bank connections

3. **`/lib/server/cache-service.ts`** - Server-side cache management (improved)
   - Now logs cache operations
   - Supports granular invalidation by type
   - Added `invalidateAllUserCaches()` for bulk operations

4. **`/app/api/clear-cache/route.ts`** - API endpoint (improved)
   - Now accepts `scope` parameter (`all`, `transactions`, `accounts`, `balances`, `budgets`)
   - Accepts `reason` parameter for logging
   - Returns detailed information about what was cleared

5. **`/contexts/query-provider.tsx`** - Global event listener (new)
   - Listens for `nexpass:cache-invalidate` events
   - Automatically refetches active queries when caches are invalidated
   - Clears preload throttle after bank connections

## Usage Examples

### Automatic Bank Connection Invalidation

The link-bank callback page now automatically invalidates all caches:

```typescript
// /app/link-bank/callback/page.tsx
const { invalidateAfterBankConnection } = useCacheInvalidation();

// After successful bank connection
await invalidateAfterBankConnection();
```

### Manual Cache Invalidation

Use the hook in any component:

```typescript
'use client';

import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';

function MyComponent() {
  const { invalidateAll, invalidateClient, invalidateServer } = useCacheInvalidation();
  
  const handleUpdate = async () => {
    // After updating data
    const result = await invalidateAll({ 
      scope: 'transactions', 
      reason: 'user-update' 
    });
    
    // Check if invalidation was successful
    if (result.overall) {
      console.log('Cache cleared successfully');
    } else {
      console.warn('Partial cache invalidation:', result);
      // Continue anyway - partial is better than none
    }
  };
  
  // ... rest of component
}
```

### Listening for Cache Changes

React to cache invalidation events:

```typescript
'use client';

import { useCacheInvalidationListener } from '@/hooks/useCacheInvalidation';

function MyComponent() {
  useCacheInvalidationListener((scope, reason) => {
    console.log(`Cache invalidated: ${scope} (${reason})`);
    // React to cache changes
    if (scope === 'transactions' || scope === 'all') {
      // Refresh your data
    }
  });
  
  // ... rest of component
}
```

### Clear All Caches (Admin/Debug)

The sidebar clear cache button now uses the centralized system:

```typescript
// /components/sidebar/nav-user.tsx
const { invalidateAll } = useCacheInvalidation();

const result = await invalidateAll({ 
  scope: 'all', 
  reason: 'manual-clear-all' 
});

if (result.overall) {
  console.log('✅ All caches cleared');
} else {
  console.warn('⚠️ Some caches could not be cleared:', result);
}
window.location.reload(); // Hard reload
```

### Error Handling Pattern

**IMPORTANT**: Cache invalidation functions **never throw errors**. They always return success/failure indicators:

```typescript
// ✅ Correct - check return value
const result = await invalidateAll({ scope: 'transactions' });
if (!result.overall) {
  console.warn('Cache invalidation failed', result);
  // Continue execution - partial cache clear is OK
}

// ❌ Wrong - don't use try/catch expecting errors
try {
  await invalidateAll({ scope: 'transactions' });
} catch (error) {
  // This will never catch anything!
}
```

Return values:
- `invalidateAll()` → `{ server: boolean, client: boolean, overall: boolean }`
- `invalidateServer()` → `boolean`
- `invalidateClient()` → `boolean`
- `invalidateAfterBankConnection()` → `{ server: boolean, client: boolean, overall: boolean }`

## Cache Scopes

The system supports granular invalidation:

- **`all`** - Everything (default)
- **`transactions`** - Transaction data, metrics, timeseries
- **`accounts`** - Account details, requisitions
- **`balances`** - Balance information
- **`budgets`** - Budget and goal data

## How It Works

### Flow for Bank Connection

1. User completes bank connection in GoCardless
2. Callback page receives confirmation
3. `invalidateAfterBankConnection()` is called
4. **Server-side**: POST to `/api/clear-cache` with `scope: 'all'`
   - Clears `__tx_cache`, `__acct_cache`, `__acct_tx_cache`
   - Calls `invalidateUserCache(userId, 'all')`
5. **Client-side**: React Query invalidation
   - Calls `queryClient.invalidateQueries()`
   - Clears `queryClient` cache
   - Removes localStorage cache
6. **Event dispatch**: `nexpass:cache-invalidate` custom event fired
7. **QueryProvider listener**: Refetches all active queries
8. **User sees**: Fresh data automatically loaded

### Cache Levels

```
┌─────────────────────────────────────┐
│   Browser                           │
│   - localStorage (React Query)      │
│   - sessionStorage (preload flags)  │
│   - Service Worker caches           │
└─────────────────────────────────────┘
              ↕️
┌─────────────────────────────────────┐
│   React Query (Client)              │
│   - Query cache                     │
│   - Mutation cache                  │
│   - Query defaults                  │
└─────────────────────────────────────┘
              ↕️
┌─────────────────────────────────────┐
│   API Routes (Server)               │
│   - __tx_cache (global)             │
│   - __acct_cache (global)           │
│   - __acct_tx_cache (global)        │
└─────────────────────────────────────┘
              ↕️
┌─────────────────────────────────────┐
│   Cache Service (Server)            │
│   - __user_cache (per user)         │
│   - __balance_cache (per user)      │
└─────────────────────────────────────┘
              ↕️
┌─────────────────────────────────────┐
│   Database                          │
│   - MongoDB (encrypted banking)     │
│   - Appwrite (user prefs, budgets)  │
└─────────────────────────────────────┘
```

All levels are coordinated through the invalidation system!

## Best Practices

1. **Use the hook**: Always use `useCacheInvalidation` instead of manual fetch calls
2. **Specify scope**: Use the narrowest scope possible (e.g., `transactions` vs `all`)
3. **Provide reason**: Always include a descriptive reason for logging/debugging
4. **Silent mode**: Use `silent: true` for background operations
5. **Error handling**: Cache invalidation **never throws errors** - it returns success/failure objects
6. **Check results**: Always check the returned object to handle partial failures gracefully
7. **Non-blocking**: Partial cache invalidation is better than none - continue execution even on failures

## Events to Trigger Invalidation

Consider invalidating caches when:
- ✅ Bank account connected/disconnected
- ✅ Transactions manually updated
- ⚠️ Budget changes (budgets require server restart for full clear)
- ⚠️ Category assignments changed
- ⚠️ Account exclusion toggled
- ⚠️ GDPR data deletion

## Debugging

### Check Cache Status

```typescript
// GET request to see current cache size
const response = await fetch('/api/clear-cache');
const status = await response.json();
console.log(status.cacheStatus);
```

### Monitor Invalidation Events

```typescript
// Browser console
window.addEventListener('nexpass:cache-invalidate', (e) => {
  console.log('Cache invalidated:', e.detail);
});
```

### Server Logs

Look for these log messages:
- `[Cache] Invalidating user cache for {userId} (type: {type})`
- `[API] Clear cache request (userId: {id}, scope: {scope}, reason: {reason})`
- `[QueryProvider] Cache invalidation event received`

## Future Improvements

- [ ] Add cache warming after invalidation
- [ ] Implement optimistic updates to reduce invalidation frequency
- [ ] Add cache metrics/monitoring dashboard
- [ ] Support partial transaction cache invalidation (by date range)
- [ ] WebSocket-based real-time cache invalidation across tabs
