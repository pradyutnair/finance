/**
 * Centralized configuration for Appwrite database and collection IDs
 * 
 * SECURITY NOTE:
 * - Client-safe configs (NEXT_PUBLIC_*) can be used in client components
 * - Server-only configs must only be used in API routes and server-side code
 * - Collection IDs are not secrets, but exposing server-side IDs to clients is unnecessary
 *   and could reveal internal structure. Appwrite permissions handle access control.
 */

function getRequiredEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (defaultValue) {
      return defaultValue;
    }
    // Only throw in server-side context, not during client-side rendering
    if (typeof window === 'undefined') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    // For client-side, return a default or empty string to prevent crashes
    return '';
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getServerOnlyEnv(key: string): string {
  // Server-only env vars should never have fallbacks - fail fast if misconfigured
  const value = process.env[key];
  if (!value) {
    if (typeof window === 'undefined') {
      throw new Error(`Missing required server-side environment variable: ${key}`);
    }
    // If accessed client-side, this is a configuration error
    throw new Error(`Server-only environment variable ${key} accessed in client-side code`);
  }
  return value;
}

// Appwrite Configuration - lazy getters to support client/server usage
export const APPWRITE_CONFIG = {
  get endpoint(): string {
    return getRequiredEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT', 'https://fra.cloud.appwrite.io/v1');
  },
  get projectId(): string {
    return getRequiredEnv('NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  },
  get databaseId(): string {
    return getRequiredEnv('NEXT_PUBLIC_APPWRITE_DATABASE_ID');
  },
  get apiKey(): string | undefined {
    return process.env.APPWRITE_API_KEY;
  },
} as const;

// Client-safe collection IDs (can be used in client components)
// Only expose collections that are actually needed client-side
export const CLIENT_COLLECTIONS = {
  get usersPrivate(): string {
    return getOptionalEnv('NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID', 'users_private');
  },
} as const;

// Server-only collection IDs (must only be used in API routes and server-side code)
// No fallbacks - fail fast if misconfigured
export const SERVER_COLLECTIONS = {
  get requisitions(): string {
    return getServerOnlyEnv('APPWRITE_REQUISITIONS_COLLECTION_ID');
  },
  get bankConnections(): string {
    return getServerOnlyEnv('APPWRITE_BANK_CONNECTIONS_COLLECTION_ID');
  },
  get bankAccounts(): string {
    return getServerOnlyEnv('APPWRITE_BANK_ACCOUNTS_COLLECTION_ID');
  },
  get balances(): string {
    return getServerOnlyEnv('APPWRITE_BALANCES_COLLECTION_ID');
  },
  get transactions(): string {
    return getServerOnlyEnv('APPWRITE_TRANSACTIONS_COLLECTION_ID');
  },
  get preferences(): string {
    return getServerOnlyEnv('APPWRITE_PREFERENCES_COLLECTION_ID');
  },
} as const;

// Legacy export for backward compatibility - use SERVER_COLLECTIONS or CLIENT_COLLECTIONS instead
// @deprecated Use SERVER_COLLECTIONS or CLIENT_COLLECTIONS based on context
export const COLLECTIONS = {
  get usersPrivate(): string {
    return CLIENT_COLLECTIONS.usersPrivate;
  },
  get requisitions(): string {
    return SERVER_COLLECTIONS.requisitions;
  },
  get bankConnections(): string {
    return SERVER_COLLECTIONS.bankConnections;
  },
  get bankAccounts(): string {
    return SERVER_COLLECTIONS.bankAccounts;
  },
  get balances(): string {
    return SERVER_COLLECTIONS.balances;
  },
  get transactions(): string {
    return SERVER_COLLECTIONS.transactions;
  },
  get preferences(): string {
    return SERVER_COLLECTIONS.preferences;
  },
} as const;

