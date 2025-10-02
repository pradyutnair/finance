import 'server-only';

/**
 * GoCardless data adapters to separate public (queryable) and sensitive (encrypted) data.
 * 
 * Public data: Fields needed for filtering, sorting, and analytics
 * Sensitive data: PII and detailed information that must be encrypted
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
  status?: string;
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
  raw?: any; // Full raw transaction object from GoCardless
}

/**
 * Extract public (queryable) transaction fields from GoCardless transaction.
 */
export function toPublicTransaction(
  gcTxn: any,
  userId: string,
  accountId: string
): PublicTransaction {
  const bookingDate = gcTxn.bookingDate
    ? String(gcTxn.bookingDate).slice(0, 10)
    : null;
  const valueDate = gcTxn.valueDate ? String(gcTxn.valueDate).slice(0, 10) : null;

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
    transactionId: (gcTxn.transactionId || gcTxn.internalTransactionId || '').toString().slice(0, 255),
    accountId,
    userId,
    amount: String(gcTxn.transactionAmount?.amount ?? '0'),
    currency: (gcTxn.transactionAmount?.currency || 'EUR').toString().toUpperCase().slice(0, 3),
    bookingDate,
    bookingMonth,
    bookingYear,
    bookingWeekday,
    valueDate,
    status: gcTxn.status || undefined,
    category: undefined, // Will be set by categorization logic
    exclude: false,
  };
}

/**
 * Extract sensitive (encrypted) transaction fields from GoCardless transaction.
 */
export function toSensitiveTransaction(gcTxn: any): SensitiveTransaction {
  const description =
    gcTxn.remittanceInformationUnstructured ||
    gcTxn.additionalInformation ||
    '';
  const counterparty = gcTxn.creditorName || gcTxn.debtorName || '';

  return {
    description: description.toString().slice(0, 500),
    counterparty: counterparty.toString().slice(0, 255),
    merchantName: gcTxn.merchantName || gcTxn.creditorName || undefined,
    creditorName: gcTxn.creditorName || undefined,
    debtorName: gcTxn.debtorName || undefined,
    remittanceInfo: gcTxn.remittanceInformationUnstructured || undefined,
    additionalInfo: gcTxn.additionalInformation || undefined,
    bookingDateTime: gcTxn.bookingDateTime
      ? String(gcTxn.bookingDateTime).slice(0, 25)
      : null,
    raw: gcTxn, // Store full raw transaction
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
 * Extract public (queryable) bank account fields.
 */
export function toPublicBankAccount(
  gcAccount: any,
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
    currency: gcAccount.currency || 'EUR',
    status: 'active', // Default to active on creation
  };
}

/**
 * Extract sensitive (encrypted) bank account fields.
 */
export function toSensitiveBankAccount(gcAccount: any): SensitiveBankAccount {
  return {
    accountName: gcAccount.name || undefined,
    iban: gcAccount.iban || undefined,
    bban: gcAccount.bban || undefined,
    maskedPan: gcAccount.maskedPan || undefined,
    ownerName: gcAccount.ownerName || undefined,
    product: gcAccount.product || undefined,
    cashAccountType: gcAccount.cashAccountType || undefined,
    raw: gcAccount,
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
 * Extract public (queryable) balance fields.
 */
export function toPublicBankBalance(
  gcBalance: any,
  userId: string,
  accountId: string
): PublicBankBalance {
  return {
    accountId,
    userId,
    balanceAmount: gcBalance.balanceAmount?.amount || '0',
    currency: gcBalance.balanceAmount?.currency || 'EUR',
    balanceType: gcBalance.balanceType || 'closingBooked',
    referenceDate:
      gcBalance.referenceDate || new Date().toISOString().split('T')[0],
  };
}

/**
 * Extract sensitive (encrypted) balance fields.
 */
export function toSensitiveBankBalance(gcBalance: any): SensitiveBankBalance {
  return {
    balanceDetails: gcBalance.balanceDetails || undefined,
    raw: gcBalance,
  };
}

// ==================== BANK CONNECTIONS ====================

export interface PublicBankConnection {
  userId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  requisitionId?: string;
  logoUrl?: string;
  transactionTotalDays?: number;
  maxAccessValidForDays?: number;
}

export interface SensitiveBankConnection {
  agreementId?: string;
  accounts?: string[]; // Account IDs linked to this connection
  metadata?: any;
  raw?: any;
}

/**
 * Extract public (queryable) connection fields.
 */
export function toPublicBankConnection(
  requisition: any,
  userId: string,
  institutionMetadata?: {
    logoUrl?: string;
    transactionTotalDays?: number;
    maxAccessValidForDays?: number;
  }
): PublicBankConnection {
  return {
    userId,
    institutionId: requisition.institution_id,
    institutionName: requisition.institution_name || 'Unknown Bank',
    status: 'active',
    requisitionId: requisition.id,
    logoUrl: institutionMetadata?.logoUrl,
    transactionTotalDays: institutionMetadata?.transactionTotalDays,
    maxAccessValidForDays: institutionMetadata?.maxAccessValidForDays,
  };
}

/**
 * Extract sensitive (encrypted) connection fields.
 */
export function toSensitiveBankConnection(requisition: any): SensitiveBankConnection {
  return {
    agreementId: requisition.agreement || undefined,
    accounts: requisition.accounts || [],
    metadata: {
      reference: requisition.reference,
      redirect: requisition.redirect,
      link: requisition.link,
      created: requisition.created,
    },
    raw: requisition,
  };
}

// ==================== REQUISITIONS ====================

export interface PublicRequisition {
  requisitionId: string;
  userId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  createdAt?: string;
}

export interface SensitiveRequisition {
  reference?: string;
  redirectUri?: string;
  agreementId?: string;
  accounts?: string[];
  link?: string;
  raw?: any;
}

/**
 * Extract public (queryable) requisition fields.
 */
export function toPublicRequisition(
  requisition: any,
  userId: string
): PublicRequisition {
  return {
    requisitionId: requisition.id,
    userId,
    institutionId: requisition.institution_id,
    institutionName: requisition.institution_name || 'Unknown Bank',
    status: requisition.status,
    createdAt: requisition.created || new Date().toISOString(),
  };
}

/**
 * Extract sensitive (encrypted) requisition fields.
 */
export function toSensitiveRequisition(requisition: any): SensitiveRequisition {
  return {
    reference: requisition.reference || undefined,
    redirectUri: requisition.redirect || undefined,
    agreementId: requisition.agreement || undefined,
    accounts: requisition.accounts || [],
    link: requisition.link || undefined,
    raw: requisition,
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
    agreementId: sensitiveData.agreementId,
    accounts: sensitiveData.accounts,
    metadata: sensitiveData.metadata,
  };
}

export function mergeRequisitionData(
  publicData: PublicRequisition,
  sensitiveData: SensitiveRequisition
): any {
  return {
    ...publicData,
    reference: sensitiveData.reference,
    redirectUri: sensitiveData.redirectUri,
    agreementId: sensitiveData.agreementId,
    accounts: sensitiveData.accounts,
    link: sensitiveData.link,
  };
}
