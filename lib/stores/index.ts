// Re-export Zustand stores as hooks with the same names as the old context hooks
// This makes migration easier and maintains backwards compatibility

export { useAuthStore as useAuth } from './auth-store';
export { useCurrencyStore as useCurrency, SUPPORTED_CURRENCIES } from './currency-store';
export { useDateRangeStore as useDateRange } from './date-range-store';
export { useTransactionsStore } from './transactions-store';
export { useCategoriesStore } from './categories-store';
export { useAccountsStore } from './accounts-store';
export { useMetricsStore } from './metrics-store';

// Convenience exports for direct access to store methods
export { useTransactionsStore as useTransactions } from './transactions-store';
export { useCategoriesStore as useCategories } from './categories-store';
export { useAccountsStore as useAccounts } from './accounts-store';
export { useMetricsStore as useMetrics } from './metrics-store';
