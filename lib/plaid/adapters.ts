import 'server-only';

/**
 * Plaid data adapters to separate public (queryable) and sensitive (encrypted) data.
 * These adapters maintain compatibility with the existing encryption and database structure
 * while adapting Plaid's data format to match our existing schema.
 */

// ==================== TRANSACTIONS ====================

export interface PublicTransaction {
  transactionId: string;
  accountId: string;
  userId: string;
  amount: string;
  currency: string;
  bookingDate: string | null;
  bookingMonth?: string; // YYYY-MM format for grouping
  bookingYear?: number;
  bookingWeekday?: string; // 'Mon', 'Tue', etc.
  valueDate: string | null;
  authorizedDate?: string | null; // When transaction was authorized
  status?: string;
  pending?: boolean; // Transaction pending status
  paymentChannel?: string; // online, in store, etc.
  category?: string | null;
  exclude?: boolean;
}

export interface SensitiveTransaction {
  description: string;
  counterparty: string;
  merchantName?: string;
  creditorName?: string;
  debtorName?: string;
  remittanceInfo?: string;
  additionalInfo?: string;
  bookingDateTime?: string | null;
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
  counterparties?: Array<{
    name: string;
    type: string;
    website?: string;
    logoUrl?: string;
    confidenceLevel?: string;
    entityId?: string;
  }>;
  personalFinanceCategory?: {
    primary?: string;
    detailed?: string;
    confidenceLevel?: string;
    iconUrl?: string;
  };
  logoUrl?: string;
  website?: string;
  checkNumber?: string;
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
  raw?: any; // Full raw transaction object from Plaid
}

/**
 * Extract public (queryable) transaction fields from Plaid transaction.
 */
export function toPublicTransaction(
  plaidTxn: any,
  userId: string,
  accountId: string
): PublicTransaction {
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

  return {
    transactionId: (plaidTxn.transaction_id || '').toString().slice(0, 255),
    accountId,
    userId,
    amount: String(plaidTxn.amount ?? '0'),
    currency: (plaidTxn.iso_currency_code || 'USD').toString().toUpperCase().slice(0, 3),
    bookingDate,
    bookingMonth,
    bookingYear,
    bookingWeekday,
    valueDate,
    authorizedDate,
    status: plaidTxn.pending ? 'pending' : 'posted',
    pending: Boolean(plaidTxn.pending),
    paymentChannel: plaidTxn.payment_channel || undefined,
    category: undefined, // Will be set by categorization logic
    exclude: false,
  };
}

/**
 * Extract sensitive (encrypted) transaction fields from Plaid transaction.
 */
export function toSensitiveTransaction(plaidTxn: any): SensitiveTransaction {
  // Improved description prioritization: merchant_name > name > original_description
  const description = plaidTxn.merchant_name || plaidTxn.name || plaidTxn.original_description || '';

  // Enhanced counterparty extraction with multiple sources
  let counterparty = plaidTxn.merchant_name || '';
  if (!counterparty && plaidTxn.counterparties && plaidTxn.counterparties.length > 0) {
    // Use the highest confidence counterparty
    const primaryCounterparty = plaidTxn.counterparties.reduce((best: any, current: any) => {
      if (!best || current.confidence_level === 'VERY_HIGH') return current;
      if (best.confidence_level === 'VERY_HIGH') return best;
      if (current.confidence_level === 'HIGH' && best.confidence_level !== 'HIGH') return current;
      return best;
    }, plaidTxn.counterparties[0]);
    counterparty = primaryCounterparty.name || '';
  }

  // Extract location data if available
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
  })) : undefined;

  // Extract personal finance category with confidence
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
    description: description.toString().slice(0, 500),
    counterparty: counterparty.toString().slice(0, 255),
    merchantName: plaidTxn.merchant_name || undefined,
    creditorName: plaidTxn.merchant_name || undefined,
    debtorName: undefined, // Plaid doesn't distinguish creditor/debtor
    remittanceInfo: plaidTxn.original_description || undefined,
    additionalInfo: plaidTxn.payment_details?.reference || undefined,
    bookingDateTime: plaidTxn.datetime
      ? String(plaidTxn.datetime).slice(0, 25)
      : plaidTxn.date
      ? `${plaidTxn.date}T00:00:00Z`
      : null,
    location,
    counterparties,
    personalFinanceCategory,
    logoUrl: plaidTxn.logo_url || undefined,
    website: plaidTxn.website || undefined,
    checkNumber: plaidTxn.check_number || undefined,
    paymentMeta,
    raw: plaidTxn, // Store full raw transaction
  };
}

// ==================== BANK ACCOUNTS ====================

export interface PublicBankAccount {
  accountId: string;
  userId: string;
  institutionId: string;
  institutionName?: string;
  currency: string;
  status: string;
}

export interface SensitiveBankAccount {
  accountName?: string;
  iban?: string;
  bban?: string;
  maskedPan?: string;
  ownerName?: string;
  product?: string;
  cashAccountType?: string;
  raw?: any; // Full account details
}

/**
 * Extract public (queryable) bank account fields from Plaid account.
 */
export function toPublicBankAccount(
  plaidAccount: any,
  userId: string,
  accountId: string,
  institutionId: string,
  institutionName?: string
): PublicBankAccount {
  return {
    accountId,
    userId,
    institutionId,
    institutionName,
    currency: plaidAccount.balances?.iso_currency_code || 'USD',
    status: 'active', // Default to active on creation
  };
}

/**
 * Extract sensitive (encrypted) bank account fields from Plaid account.
 */
export function toSensitiveBankAccount(plaidAccount: any): SensitiveBankAccount {
  return {
    accountName: plaidAccount.name || undefined,
    iban: plaidAccount.official_name || undefined,
    bban: undefined, // Plaid doesn't provide this
    maskedPan: plaidAccount.mask || undefined,
    ownerName: undefined, // Plaid doesn't provide owner name
    product: plaidAccount.subtype || plaidAccount.type || undefined,
    cashAccountType: plaidAccount.type || undefined,
    raw: plaidAccount,
  };
}

// ==================== BANK BALANCES ====================

export interface PublicBankBalance {
  accountId: string;
  userId: string;
  balanceAmount: string;
  currency: string;
  balanceType: string;
  referenceDate: string;
}

export interface SensitiveBankBalance {
  balanceDetails?: any; // Additional balance metadata
  raw?: any;
}

/**
 * Extract public (queryable) balance fields from Plaid balance.
 */
export function toPublicBankBalance(
  plaidBalance: any,
  userId: string,
  accountId: string
): PublicBankBalance {
  const currentBalance = plaidBalance.current || plaidBalance.available || 0;

  return {
    accountId,
    userId,
    balanceAmount: String(currentBalance),
    currency: plaidBalance.iso_currency_code || 'USD',
    balanceType: 'current', // Plaid uses current/available instead of booking types
    referenceDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Extract sensitive (encrypted) balance fields from Plaid balance.
 */
export function toSensitiveBankBalance(plaidBalance: any): SensitiveBankBalance {
  return {
    balanceDetails: {
      current: plaidBalance.current,
      available: plaidBalance.available,
      limit: plaidBalance.limit,
      iso_currency_code: plaidBalance.iso_currency_code,
      unofficial_currency_code: plaidBalance.unofficial_currency_code,
    },
    raw: plaidBalance,
  };
}

// ==================== BANK CONNECTIONS ====================

export interface PublicBankConnection {
  userId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  itemId?: string; // Plaid equivalent of requisitionId
  logoUrl?: string;
  transactionTotalDays?: number;
  maxAccessValidForDays?: number;
}

export interface SensitiveBankConnection {
  accessToken?: string; // Encrypted access token
  itemId?: string;
  cursor?: string; // Transaction cursor for pagination
  webhookEnabled?: boolean;
  accounts?: string[]; // Account IDs linked to this connection
  metadata?: any;
  raw?: any;
}

/**
 * Extract public (queryable) connection fields from Plaid item.
 */
export function toPublicBankConnection(
  plaidItem: any,
  userId: string,
  institutionMetadata?: {
    institution_id?: string;
    name?: string;
    logo?: string;
    transaction_total_days?: number;
  }
): PublicBankConnection {
  return {
    userId,
    institutionId: institutionMetadata?.institution_id || plaidItem.institution_id || 'unknown',
    institutionName: institutionMetadata?.name || 'Unknown Bank',
    status: plaidItem.status === 'GOOD' ? 'active' : 'error',
    itemId: plaidItem.item_id,
    logoUrl: institutionMetadata?.logo,
    transactionTotalDays: institutionMetadata?.transaction_total_days || 730, // Default 2 years
    maxAccessValidForDays: undefined, // Plaid access doesn't expire unless revoked
  };
}

/**
 * Extract sensitive (encrypted) connection fields from Plaid item.
 */
export function toSensitiveBankConnection(
  plaidItem: any,
  accessToken?: string,
  cursor?: string
): SensitiveBankConnection {
  return {
    accessToken,
    itemId: plaidItem.item_id,
    cursor,
    webhookEnabled: plaidItem.webhook || false,
    accounts: [], // Will be populated separately
    metadata: {
      status: plaidItem.status,
      consent_expiration_time: plaidItem.consent_expiration_time,
      updated_webhook: plaidItem.updated_webhook,
    },
    raw: plaidItem,
  };
}

// ==================== ITEMS (Plaid equivalent of Requisitions) ====================

export interface PublicItem {
  itemId: string;
  userId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  createdAt?: string;
}

export interface SensitiveItem {
  accessToken?: string;
  cursor?: string;
  webhookEnabled?: boolean;
  accounts?: string[];
  metadata?: any;
  raw?: any;
}

/**
 * Extract public (queryable) item fields from Plaid item response.
 */
export function toPublicItem(
  plaidItemResponse: any,
  userId: string,
  institutionName?: string
): PublicItem {
  const item = plaidItemResponse.item;

  return {
    itemId: item.item_id,
    userId,
    institutionId: item.institution_id || 'unknown',
    institutionName: institutionName || 'Unknown Bank',
    status: item.status || 'unknown',
    createdAt: new Date().toISOString(), // Plaid doesn't provide creation timestamp
  };
}

/**
 * Extract sensitive (encrypted) item fields.
 */
export function toSensitiveItem(
  plaidItemResponse: any,
  accessToken?: string,
  cursor?: string
): SensitiveItem {
  const item = plaidItemResponse.item;

  return {
    accessToken,
    cursor,
    webhookEnabled: item.webhook || false,
    accounts: [], // Will be populated separately
    metadata: {
      status: item.status,
      consent_expiration_time: item.consent_expiration_time,
      updated_webhook: item.updated_webhook,
    },
    raw: plaidItemResponse,
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Merge public and sensitive data for API responses.
 */
export function mergeTransactionData(
  publicData: PublicTransaction,
  sensitiveData: SensitiveTransaction
): any {
  return {
    ...publicData,
    description: sensitiveData.description,
    counterparty: sensitiveData.counterparty,
    merchantName: sensitiveData.merchantName,
    creditorName: sensitiveData.creditorName,
    debtorName: sensitiveData.debtorName,
    bookingDateTime: sensitiveData.bookingDateTime,
    location: sensitiveData.location,
    counterparties: sensitiveData.counterparties,
    personalFinanceCategory: sensitiveData.personalFinanceCategory,
    logoUrl: sensitiveData.logoUrl,
    website: sensitiveData.website,
    checkNumber: sensitiveData.checkNumber,
    paymentMeta: sensitiveData.paymentMeta,
    // Note: raw is omitted from API responses for security
  };
}

export function mergeBankAccountData(
  publicData: PublicBankAccount,
  sensitiveData: SensitiveBankAccount
): any {
  return {
    ...publicData,
    accountName: sensitiveData.accountName,
    iban: sensitiveData.iban,
    ownerName: sensitiveData.ownerName,
    product: sensitiveData.product,
  };
}

export function mergeBankBalanceData(
  publicData: PublicBankBalance,
  sensitiveData: SensitiveBankBalance
): any {
  return {
    ...publicData,
    balanceDetails: sensitiveData.balanceDetails,
  };
}

export function mergeBankConnectionData(
  publicData: PublicBankConnection,
  sensitiveData: SensitiveBankConnection
): any {
  return {
    ...publicData,
    itemId: sensitiveData.itemId,
    accounts: sensitiveData.accounts,
    metadata: sensitiveData.metadata,
    // accessToken is excluded for security
  };
}

export function mergeItemData(
  publicData: PublicItem,
  sensitiveData: SensitiveItem
): any {
  return {
    ...publicData,
    accounts: sensitiveData.accounts,
    metadata: sensitiveData.metadata,
    // accessToken is excluded for security
  };
}

// ==================== CATEGORIES ====================

/**
 * Map Plaid categories to our category system.
 * Enhanced to use personal_finance_category when available.
 */
export function mapPlaidCategory(
  plaidCategories: string[] | null,
  personalFinanceCategory?: { primary?: string; detailed?: string; confidenceLevel?: string }
): string | null {
  // Prefer the new personal_finance_category structure if available
  if (personalFinanceCategory?.detailed && personalFinanceCategory.confidenceLevel !== 'LOW') {
    const detailed = personalFinanceCategory.detailed.toUpperCase();
    const primary = personalFinanceCategory.primary?.toUpperCase();

    // Map detailed categories first (more specific)
    const detailedCategoryMap: Record<string, string> = {
      'FOOD_AND_DRINK_FAST_FOOD': 'Dining',
      'FOOD_AND_DRINK_RESTAURANTS': 'Dining',
      'FOOD_AND_DRINK_GROCERIES': 'Groceries',
      'FOOD_AND_DRINK_DELIVERY': 'Dining',
      'GENERAL_MERCHANDISE_SUPERSTORES': 'Shopping',
      'GENERAL_MERCHANDISE_DEPARTMENT_STORES': 'Shopping',
      'GENERAL_MERCHANDISE_DISCOUNT_STORES': 'Shopping',
      'SHOPPING_CLOTHING': 'Shopping',
      'SHOPPING_ELECTRONICS': 'Shopping',
      'TRAVEL_FLIGHTS': 'Travel',
      'TRAVEL_TAXI': 'Travel',
      'TRAVEL_HOTELS': 'Travel',
      'TRANSPORTATION_GAS': 'Transportation',
      'TRANSPORTATION_PUBLIC_TRANSIT': 'Transportation',
      'ENTERTAINMENT_MOVIES': 'Entertainment',
      'ENTERTAINMENT_GAMES': 'Entertainment',
      'ENTERTAINMENT_SPORTS': 'Entertainment',
      'HEALTHCARE_MEDICAL_SERVICES': 'Healthcare',
      'HEALTHCARE_PHARMACY': 'Healthcare',
      'UTILITIES_ELECTRIC': 'Utilities',
      'UTILITIES_WATER': 'Utilities',
      'UTILITIES_GAS': 'Utilities',
      'UTILITIES_INTERNET': 'Utilities',
      'UTILITIES_PHONE': 'Utilities',
      'LOAN_PAYMENTS': 'Loan Payment',
      'MORTGAGE_RENT': 'Housing',
      'INSURANCE_PREMIUMS': 'Insurance',
      'BANK_FEES': 'Bank Fee',
      'TRANSFER_IN': 'Income',
      'TRANSFER_OUT': 'Transfer',
      'INVESTMENT_RETURN': 'Investment',
      'PAYROLL': 'Income',
      'TAX_REFUND': 'Income',
    };

    if (detailedCategoryMap[detailed]) {
      return detailedCategoryMap[detailed];
    }

    // Fallback to primary category mapping
    if (primary) {
      const primaryCategoryMap: Record<string, string> = {
        'FOOD_AND_DRINK': 'Dining',
        'GENERAL_MERCHANDISE': 'Shopping',
        'SHOPPING': 'Shopping',
        'TRAVEL': 'Travel',
        'TRANSPORTATION': 'Transportation',
        'ENTERTAINMENT': 'Entertainment',
        'HEALTHCARE': 'Healthcare',
        'UTILITIES': 'Utilities',
        'LOAN': 'Loan Payment',
        'TRANSFER': 'Transfer',
        'INVESTMENT': 'Investment',
        'GOVERNMENT': 'Government',
        'CHARITY': 'Donations',
        'TAX': 'Tax',
        'INSURANCE': 'Insurance',
        'BANK_FEES': 'Bank Fee',
        'RENT': 'Housing',
        'PERSONAL': 'Personal',
        'PAYMENTS': 'Payment',
      };

      if (primaryCategoryMap[primary]) {
        return primaryCategoryMap[primary];
      }
    }
  }

  // Fallback to legacy category mapping
  if (!plaidCategories || plaidCategories.length === 0) {
    return null;
  }

  // Get the most specific category (last element in the hierarchy)
  const specificCategory = plaidCategories[plaidCategories.length - 1];

  // Map common Plaid categories to our system
  const categoryMap: Record<string, string> = {
    'TRANSFER': 'Transfer',
    'PAYROLL': 'Income',
    'DEPOSIT': 'Income',
    'PAYMENT': 'Payment',
    'BANK_FEES': 'Bank Fee',
    'ATM': 'ATM Withdrawal',
    'LOAN': 'Loan Payment',
    'MORTGAGE': 'Housing',
    'RENT': 'Housing',
    'UTILITIES': 'Utilities',
    'GROCERIES': 'Groceries',
    'RESTAURANTS': 'Dining',
    'TRAVEL': 'Travel',
    'ENTERTAINMENT': 'Entertainment',
    'SHOPPING': 'Shopping',
    'HEALTHCARE': 'Healthcare',
    'EDUCATION': 'Education',
    'PERSONAL': 'Personal',
    'INVESTMENT': 'Investment',
    'GAMBLING': 'Entertainment',
    'GOVERNMENT': 'Government',
    'CHARITY': 'Donations',
    'TAX': 'Tax',
    'INSURANCE': 'Insurance',
  };

  return categoryMap[specificCategory.toUpperCase()] || specificCategory;
}