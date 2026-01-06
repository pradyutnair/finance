/**
 * Centralized configuration for Appwrite database and collection IDs
 * All hardcoded values should be replaced with environment variables
 * 
 * Note: Validation is lazy to support both server and client-side usage
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

// Appwrite Configuration - lazy getters to support client/server usage
export const APPWRITE_CONFIG = {
  get endpoint(): string {
    return getRequiredEnv('NEXT_PUBLIC_APPWRITE_ENDPOINT');
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

// Collection IDs - use environment variables with fallbacks for development
export const COLLECTIONS = {
  get usersPrivate(): string {
    return getRequiredEnv('NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID');
  },
  get requisitions(): string {
    return getRequiredEnv('APPWRITE_REQUISITIONS_COLLECTION_ID');
  },
  get bankConnections(): string {
    return getRequiredEnv('APPWRITE_BANK_CONNECTIONS_COLLECTION_ID');
  },
  get bankAccounts(): string {
    return getRequiredEnv('APPWRITE_BANK_ACCOUNTS_COLLECTION_ID');
  },
  get balances(): string {
    return getRequiredEnv('APPWRITE_BALANCES_COLLECTION_ID');
  },
  get transactions(): string {
    return getRequiredEnv('APPWRITE_TRANSACTIONS_COLLECTION_ID');
  },
  get budgets(): string {
    return getRequiredEnv('APPWRITE_BUDGETS_COLLECTION_ID');
  },
  get goals(): string {
    return getRequiredEnv('APPWRITE_GOALS_COLLECTION_ID');
  },
} as const;

