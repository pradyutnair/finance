import { Client, Account, OAuthProvider, Databases } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '');

export const account = new Account(client);

// Database configuration
export const databases = new Databases(client);
export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
export const PREFERENCES_BUDGETS_COLLECTION_ID = process.env.APPWRITE_PREFERENCES_BUDGETS_COLLECTION_ID || 'preferences_budgets_dev';

// Collection IDs
export const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private';
export const CONSENT_COLLECTION_ID = process.env.APPWRITE_CONSENT_COLLECTION_ID || 'user_consent_dev';
export const COOKIE_CONSENT_COLLECTION_ID = process.env.APPWRITE_COOKIE_CONSENT_COLLECTION_ID || 'cookie_consent_dev';
export const AUDIT_LOG_COLLECTION_ID = process.env.APPWRITE_AUDIT_LOG_COLLECTION_ID || 'audit_logs_dev';
export const DELETION_LOG_COLLECTION_ID = process.env.APPWRITE_DELETION_LOG_COLLECTION_ID || 'deletion_logs_dev';
export const EXPORT_LOG_COLLECTION_ID = process.env.APPWRITE_EXPORT_LOG_COLLECTION_ID || 'export_logs_dev';
export const GOALS_COLLECTION_ID = process.env.APPWRITE_GOALS_COLLECTION_ID || 'preferences_goals_dev';
export const REQUISITIONS_COLLECTION_ID = process.env.APPWRITE_REQUISITIONS_COLLECTION_ID || 'requisitions_dev';
export const BANK_CONNECTIONS_COLLECTION_ID = process.env.APPWRITE_BANK_CONNECTIONS_COLLECTION_ID || 'bank_connections_dev';
export const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';
export const BALANCES_COLLECTION_ID = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances_dev';
export const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_plaid';

export { OAuthProvider };
export default client;
