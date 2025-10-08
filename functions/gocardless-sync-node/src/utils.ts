/**
 * Utility functions for transaction/balance formatting and encryption
 */

import { encryptQueryable, encryptRandom } from './explicit-encryption';
import { suggestCategory } from './categorize';

export function generateDocId(
  transactionId: string | undefined,
  accountId: string,
  bookingDate: string | undefined
): string {
  const rawKey = transactionId || `${accountId}_${bookingDate || ''}_${Date.now()}`;
  const cleanId = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
  return cleanId || `tx_${Date.now()}`;
}

export async function formatTransactionPayload(
  transaction: any,
  userId: string,
  accountId: string,
  docId: string
): Promise<any> {
  const transactionAmount = transaction.transactionAmount || {};
  const amount = transactionAmount.amount || '0';
  const description = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  const counterparty = transaction.creditorName || transaction.debtorName || '';
  const providerTxId = transaction.transactionId || transaction.internalTransactionId || '';

  // CRITICAL: Categorize on plaintext BEFORE encryption
  const category = await suggestCategory(description, counterparty, amount, transactionAmount.currency);

  // Build encrypted payload
  const currency = transactionAmount.currency || 'EUR';

  const payload: any = {
    // Plaintext fields (queryable)
    userId,
    category,
    exclude: false,
    bookingDate: transaction.bookingDate ? String(transaction.bookingDate).slice(0, 10) : null,

    // Encrypted queryable fields (deterministic)
    accountId: await encryptQueryable(accountId),
    transactionId: await encryptQueryable(providerTxId),

    // Encrypted sensitive fields (random)
    amount: await encryptRandom(amount),
    currency: await encryptRandom(String(currency).toUpperCase().slice(0, 3)),
    valueDate: await encryptRandom(
      transaction.valueDate ? String(transaction.valueDate).slice(0, 10) : null
    ),
    description: await encryptRandom(description ? description.slice(0, 500) : null),
    counterparty: await encryptRandom(counterparty ? counterparty.slice(0, 255) : null),
    raw: await encryptRandom(JSON.stringify(transaction).slice(0, 10000)),

    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Filter out null values
  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== null && v !== undefined)
  );
}

export async function formatBalancePayload(
  balance: any,
  userId: string,
  accountId: string
): Promise<[string, any]> {
  const balanceType = balance.balanceType || 'expected';
  const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
  const balanceAmount = balance.balanceAmount || {};
  const amount = balanceAmount.amount || '0';
  const currency = balanceAmount.currency || 'EUR';

  const docId = `${accountId}_${balanceType}`.slice(0, 36);

  const payload: any = {
    // Plaintext fields (queryable)
    userId,
    balanceType,
    referenceDate,

    // Encrypted queryable field (deterministic)
    accountId: await encryptQueryable(accountId),

    // Encrypted sensitive fields (random)
    balanceAmount: await encryptRandom(String(amount)),
    currency: await encryptRandom(String(currency).toUpperCase().slice(0, 3)),

    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Filter out null values
  const filtered = Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== null && v !== undefined)
  );

  return [docId, filtered];
}

