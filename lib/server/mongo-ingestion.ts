import { getDb } from '@/lib/mongo/client';
import { suggestCategory, findExistingCategoryMongo } from './categorize';

export async function storeRequisitionMongo(requisition: any, userId: string) {
  const db = await getDb();
  const coll = db.collection('requisitions_dev');
  
  // Build update object, omitting null/empty values for encrypted fields
  const updateFields: any = {
    userId,
    institutionId: requisition.institution_id,
    updatedAt: new Date().toISOString(),
  };
  
  // Add encrypted fields only if they have values
  if (requisition.id) updateFields.requisitionId = requisition.id;
  if (requisition.status) updateFields.status = requisition.status;
  if (requisition.reference) updateFields.reference = requisition.reference;
  if (requisition.redirect || process.env.GC_REDIRECT_URI) {
    updateFields.redirectUri = requisition.redirect || process.env.GC_REDIRECT_URI;
  }
  if (requisition.institution_name) updateFields.institutionName = requisition.institution_name;
  
  await coll.updateOne(
    { userId, institutionId: requisition.institution_id },
    {
      $set: updateFields,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

export async function storeBankConnectionMongo(
  userId: string,
  institutionId: string,
  institutionName: string,
  requisitionId: string,
  logoUrl: string | null,
  transactionTotalDays: number | null,
  maxAccessValidforDays: number | null
) {
  const db = await getDb();
  const coll = db.collection('bank_connections_dev');
  
  // Build update object, omitting null values for encrypted fields
  const updateFields: any = {
    userId,
    institutionId,
    updatedAt: new Date().toISOString(),
  };
  
  // Add encrypted fields only if they have values
  if (institutionName) updateFields.institutionName = institutionName;
  if (requisitionId) updateFields.requisitionId = requisitionId;
  updateFields.status = 'active';
  
  // Plaintext metadata fields (can be null)
  if (logoUrl) updateFields.logoUrl = logoUrl;
  if (transactionTotalDays !== null && transactionTotalDays !== undefined) {
    updateFields.transactionTotalDays = transactionTotalDays;
  }
  if (maxAccessValidforDays !== null && maxAccessValidforDays !== undefined) {
    updateFields.maxAccessValidforDays = maxAccessValidforDays;
  }
  
  await coll.updateOne(
    { userId, institutionId },
    {
      $set: updateFields,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

export async function storeBankAccountMongo(
  accountId: string,
  userId: string,
  institutionId: string,
  institutionName: string,
  accountDetails: any
) {
  const db = await getDb();
  const coll = db.collection('bank_accounts_dev');
  
  // Build update object, omitting null values for encrypted fields
  const updateFields: any = {
    userId,
    accountId,
    institutionId,
    updatedAt: new Date().toISOString(),
  };
  
  // Add encrypted fields only if they have values (can't encrypt null)
  if (accountDetails.iban) updateFields.iban = accountDetails.iban;
  if (accountDetails.name) updateFields.accountName = accountDetails.name;
  if (accountDetails.currency) updateFields.currency = accountDetails.currency;
  if (institutionName) updateFields.institutionName = institutionName;
  
  updateFields.status = 'active';
  updateFields.raw = JSON.stringify(accountDetails);
  
  await coll.updateOne(
    { accountId, userId },
    {
      $set: updateFields,
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

export async function storeBalanceMongo(
  userId: string,
  accountId: string,
  balance: any
) {
  const db = await getDb();
  const coll = db.collection('balances_dev');
  
  const balanceType = balance.balanceType || 'closingBooked';
  const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
  
  await coll.updateOne(
    { userId, accountId, balanceType, referenceDate },
    {
      $set: {
        userId,
        accountId,
        balanceAmount: balance.balanceAmount?.amount || '0',
        currency: balance.balanceAmount?.currency || 'EUR',
        balanceType,
        referenceDate,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      }
    },
    { upsert: true }
  );
}

export async function storeTransactionMongo(
  userId: string,
  accountId: string,
  transaction: any
) {
  const db = await getDb();
  const coll = db.collection('transactions_dev');
  
  const txDescription = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  const counterparty = transaction.creditorName || transaction.debtorName || '';
  const providerTransactionId = transaction.transactionId || transaction.internalTransactionId || '';
  
  // Get or suggest category (auto-categorize on ingestion)
  const existingCategory = await findExistingCategoryMongo(db, 'transactions_dev', userId, txDescription, counterparty);
  const category = existingCategory || await suggestCategory(
    txDescription,
    counterparty,
    transaction.transactionAmount?.amount,
    transaction.transactionAmount?.currency
  );
  
  // Build document, omitting null values for encrypted fields
  const doc: any = {
    userId,
    accountId,
    category,
    exclude: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Add encrypted fields only if they have values (can't encrypt null)
  if (providerTransactionId) doc.transactionId = providerTransactionId;
  if (transaction.transactionAmount?.amount !== undefined && transaction.transactionAmount?.amount !== null) {
    doc.amount = String(transaction.transactionAmount.amount);
  }
  if (transaction.transactionAmount?.currency) {
    doc.currency = transaction.transactionAmount.currency.toString().toUpperCase().slice(0, 3);
  }
  if (transaction.bookingDate) doc.bookingDate = String(transaction.bookingDate).slice(0, 10);
  if (transaction.bookingDateTime) doc.bookingDateTime = String(transaction.bookingDateTime).slice(0, 25);
  if (transaction.valueDate) doc.valueDate = String(transaction.valueDate).slice(0, 10);
  if (txDescription) doc.description = txDescription.toString().slice(0, 500);
  if (counterparty) doc.counterparty = counterparty.toString().slice(0, 255);
  
  doc.raw = JSON.stringify(transaction).slice(0, 10000);
  
  try {
    await coll.insertOne(doc);
    console.log(`✅ Stored transaction ${providerTransactionId} with category ${category}`);
  } catch (e: any) {
    // Handle duplicate key errors silently
    if (e.code === 11000) {
      console.log(`Transaction ${providerTransactionId} already exists, skipping`);
    } else {
      throw e;
    }
  }
}

