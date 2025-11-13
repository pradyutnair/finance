import 'server-only';

/**
 * Enhanced Plaid transaction adapters for the dedicated transactions_plaid table
 * This provides richer field mapping while maintaining encrypted storage
 */

// Enhanced interface for the transactions_plaid table
export interface PlaidTransactionRecord {
  // Core identifiers (Public - encrypted)
  transactionId: string;
  accountId: string;
  userId: string;

  // Financial fields (Public - encrypted)
  amount: string;
  currency: string;

  // Date fields (Public - encrypted)
  bookingDate: string | null;
  bookingMonth?: string; // YYYY-MM format for grouping
  bookingYear?: number;
  bookingWeekday?: string; // 'Mon', 'Tue', etc.
  valueDate: string | null;
  authorizedDate?: string | null;
  bookingDateTime?: string | null;

  // Transaction status (Public - encrypted)
  status?: string;
  pending?: boolean;
  paymentChannel?: string;

  // Categorization (Public - encrypted)
  category?: string | null;
  exclude?: boolean;

  // Description fields (Sensitive - encrypted)
  description: string;
  counterparty: string;
  merchantName?: string;
  originalDescription?: string;

  // Plaid-specific fields (Sensitive - encrypted)
  transactionCode?: string;
  transactionType?: string;
  checkNumber?: string;

  // Location data (Sensitive - encrypted)
  location?: {
    address?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    storeNumber?: string;
  };

  // Counterparties array (Sensitive - encrypted)
  counterparties?: Array<{
    name: string;
    type: string;
    website?: string;
    logoUrl?: string;
    confidenceLevel?: string;
    entityId?: string;
    accountNumbers?: {
      bacs?: { account?: string; sortCode?: string };
      international?: { iban?: string; bic?: string };
    };
  }>;

  // Personal finance category (Sensitive - encrypted)
  personalFinanceCategory?: {
    primary?: string;
    detailed?: string;
    confidenceLevel?: string;
    iconUrl?: string;
  };

  // Merchant information (Sensitive - encrypted)
  merchantEntityId?: string;
  logoUrl?: string;
  website?: string;

  // Payment metadata (Sensitive - encrypted)
  paymentMeta?: {
    referenceNumber?: string;
    ppdId?: string;
    payee?: string;
    byOrderOf?: string;
    payer?: string;
    paymentMethod?: string;
    paymentProcessor?: string;
    reason?: string;
  };

  // Pending transaction reference (Sensitive - encrypted)
  pendingTransactionId?: string;

  // Raw data (Sensitive - encrypted)
  raw?: any; // Full raw transaction object from Plaid

  // Metadata (Public - encrypted)
  createdAt: string;
  updatedAt?: string;
}

/**
 * Convert Plaid transaction to the enhanced transactions_plaid schema
 */
export function toPlaidTransactionRecord(
  plaidTxn: any,
  userId: string,
  accountId: string
): PlaidTransactionRecord {
  const now = new Date().toISOString();

  // Date processing
  const bookingDate = plaidTxn.date
    ? String(plaidTxn.date).slice(0, 10)
    : null;
  const valueDate = bookingDate; // Plaid doesn't separate booking/value dates
  const authorizedDate = plaidTxn.authorized_date
    ? String(plaidTxn.authorized_date).slice(0, 10)
    : null;

  // Derive time-based fields for analytics
  let bookingMonth: string | undefined;
  let bookingYear: number | undefined;
  let bookingWeekday: string | undefined;

  if (bookingDate) {
    try {
      const date = new Date(bookingDate);
      bookingYear = date.getFullYear();
      bookingMonth = `${bookingYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      bookingWeekday = weekdays[date.getDay()];
    } catch {
      // Invalid date, skip derived fields
    }
  }

  // Enhanced description prioritization
  const description = plaidTxn.merchant_name || plaidTxn.name || plaidTxn.original_description || '';

  // Enhanced counterparty extraction
  let counterparty = plaidTxn.merchant_name || '';
  if (!counterparty && plaidTxn.counterparties && plaidTxn.counterparties.length > 0) {
    const primaryCounterparty = plaidTxn.counterparties.reduce((best: any, current: any) => {
      if (!best || current.confidence_level === 'VERY_HIGH') return current;
      if (best.confidence_level === 'VERY_HIGH') return best;
      if (current.confidence_level === 'HIGH' && best.confidence_level !== 'HIGH') return current;
      return best;
    }, plaidTxn.counterparties[0]);
    counterparty = primaryCounterparty.name || '';
  }

  // Extract location data
  const location = plaidTxn.location ? {
    address: plaidTxn.location.address || undefined,
    city: plaidTxn.location.city || undefined,
    region: plaidTxn.location.region || undefined,
    postalCode: plaidTxn.location.postal_code || undefined,
    country: plaidTxn.location.country || undefined,
    lat: plaidTxn.location.lat || undefined,
    lon: plaidTxn.location.lon || undefined,
    storeNumber: plaidTxn.location.store_number || undefined,
  } : undefined;

  // Extract counterparties with full details
  const counterparties = plaidTxn.counterparties ? plaidTxn.counterparties.map((cp: any) => ({
    name: cp.name || '',
    type: cp.type || '',
    website: cp.website || undefined,
    logoUrl: cp.logo_url || undefined,
    confidenceLevel: cp.confidence_level || undefined,
    entityId: cp.entity_id || undefined,
    accountNumbers: cp.account_numbers || undefined,
  })) : undefined;

  // Extract personal finance category
  const personalFinanceCategory = plaidTxn.personal_finance_category ? {
    primary: plaidTxn.personal_finance_category.primary || undefined,
    detailed: plaidTxn.personal_finance_category.detailed || undefined,
    confidenceLevel: plaidTxn.personal_finance_category.confidence_level || undefined,
    iconUrl: plaidTxn.personal_finance_category_icon_url || undefined,
  } : undefined;

  // Extract payment metadata
  const paymentMeta = plaidTxn.payment_meta ? {
    referenceNumber: plaidTxn.payment_meta.reference_number || undefined,
    ppdId: plaidTxn.payment_meta.ppd_id || undefined,
    payee: plaidTxn.payment_meta.payee || undefined,
    byOrderOf: plaidTxn.payment_meta.by_order_of || undefined,
    payer: plaidTxn.payment_meta.payer || undefined,
    paymentMethod: plaidTxn.payment_meta.payment_method || undefined,
    paymentProcessor: plaidTxn.payment_meta.payment_processor || undefined,
    reason: plaidTxn.payment_meta.reason || undefined,
  } : undefined;

  return {
    // Core identifiers
    transactionId: String(plaidTxn.transaction_id || '').slice(0, 255),
    accountId,
    userId,

    // Financial fields
    amount: String(plaidTxn.amount ?? '0'),
    currency: (plaidTxn.iso_currency_code || 'USD').toString().toUpperCase().slice(0, 3),

    // Date fields
    bookingDate,
    bookingMonth,
    bookingYear,
    bookingWeekday,
    valueDate,
    authorizedDate,
    bookingDateTime: plaidTxn.datetime
      ? String(plaidTxn.datetime).slice(0, 25)
      : plaidTxn.date
      ? `${plaidTxn.date}T00:00:00Z`
      : null,

    // Transaction status
    status: plaidTxn.pending ? 'pending' : 'posted',
    pending: Boolean(plaidTxn.pending),
    paymentChannel: plaidTxn.payment_channel || undefined,

    // Categorization
    category: undefined, // Will be set by categorization logic
    exclude: false,

    // Description fields
    description: description.toString().slice(0, 500),
    counterparty: counterparty.toString().slice(0, 255),
    merchantName: plaidTxn.merchant_name || undefined,
    originalDescription: plaidTxn.original_description || undefined,

    // Plaid-specific fields
    transactionCode: plaidTxn.transaction_code || undefined,
    transactionType: plaidTxn.transaction_type || undefined,
    checkNumber: plaidTxn.check_number || undefined,

    // Location data
    location,

    // Counterparties
    counterparties,

    // Personal finance category
    personalFinanceCategory,

    // Merchant information
    merchantEntityId: plaidTxn.merchant_entity_id || undefined,
    logoUrl: plaidTxn.logo_url || undefined,
    website: plaidTxn.website || undefined,

    // Payment metadata
    paymentMeta,

    // Pending transaction reference
    pendingTransactionId: plaidTxn.pending_transaction_id || undefined,

    // Raw data
    raw: plaidTxn, // Store full raw transaction for debugging

    // Metadata
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create MongoDB index specifications for the transactions_plaid table
 */
export const PLAID_TRANSACTION_INDEXES = [
  // Primary index for user lookups
  { userId: 1, bookingDate: -1 },

  // Account-specific queries
  { accountId: 1, bookingDate: -1 },

  // Transaction uniqueness
  { userId: 1, transactionId: 1 },

  // Date range queries
  { userId: 1, bookingMonth: 1 },
  { userId: 1, bookingYear: 1 },

  // Status queries
  { userId: 1, pending: 1 },
  { userId: 1, status: 1 },

  // Category queries
  { userId: 1, category: 1 },

  // Counterparty search
  { userId: 1, counterparty: 1 },

  // Payment channel queries
  { userId: 1, paymentChannel: 1 },

  // Merchant queries
  { userId: 1, merchantName: 1 },

  // Date queries
  { userId: 1, authorizedDate: -1 },
  { userId: 1, valueDate: -1 },
];

/**
 * Encryption configuration for the transactions_plaid table
 * Defines which fields should be encrypted vs left searchable
 */
export const PLAID_TRANSACTION_ENCRYPTION_CONFIG = {
  // Public fields (left unencrypted for querying)
  publicFields: [
    'transactionId',
    'accountId',
    'userId',
    'amount',
    'currency',
    'bookingDate',
    'bookingMonth',
    'bookingYear',
    'bookingWeekday',
    'valueDate',
    'authorizedDate',
    'status',
    'pending',
    'paymentChannel',
    'category',
    'exclude',
    'createdAt',
    'updatedAt',
  ],

  // Sensitive fields (encrypted)
  sensitiveFields: [
    'description',
    'counterparty',
    'merchantName',
    'originalDescription',
    'transactionCode',
    'transactionType',
    'checkNumber',
    'location',
    'counterparties',
    'personalFinanceCategory',
    'merchantEntityId',
    'logoUrl',
    'website',
    'paymentMeta',
    'pendingTransactionId',
    'raw',
  ],
};