import { getDb } from '@/lib/mongo/client';
import { suggestCategory, findExistingCategoryMongo } from './categorize';
import { 
  encryptRequisitionFields, 
  encryptBankConnectionFields, 
  encryptBankAccountFields,
  encryptBalanceFields,
  encryptTransactionFields 
} from '@/lib/mongo/explicit-encryption';

export async function storeRequisitionMongo(requisition: any, userId: string) {
  const db = await getDb();
  const coll = db.collection('requisitions_dev');
  
  // Explicitly encrypt sensitive fields
  const encryptedFields = await encryptRequisitionFields(requisition, userId);
  
  // Separate query fields from update fields to avoid MongoDB conflict
  const { userId: _userId, institutionId: _institutionId, ...updateFields } = encryptedFields;
  
  // Filter out null values (can't encrypt null)
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }
  
  await coll.updateOne(
    { userId, institutionId: requisition.institution_id },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        institutionId: requisition.institution_id,
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
  
  // Explicitly encrypt sensitive fields
  const encryptedFields = await encryptBankConnectionFields(
    userId,
    institutionId,
    institutionName,
    requisitionId,
    logoUrl,
    transactionTotalDays,
    maxAccessValidforDays
  );
  
  // Separate query fields from update fields to avoid MongoDB conflict
  const { userId: _userId, institutionId: _institutionId, ...updateFields } = encryptedFields;
  
  // Filter out null values (can't encrypt null)
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }
  
  await coll.updateOne(
    { userId, institutionId },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        institutionId,
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
  
  // Explicitly encrypt sensitive fields
  const encryptedFields = await encryptBankAccountFields(
    accountId,
    userId,
    institutionId,
    institutionName,
    accountDetails
  );
  
  // Separate query fields from update fields to avoid MongoDB conflict
  const { userId: _userId, accountId: encryptedAccountId, ...updateFields } = encryptedFields;
  
  // Filter out null values (can't encrypt null)
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }
  
  await coll.updateOne(
    { accountId: encryptedAccountId, userId },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        accountId: encryptedAccountId,
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
  
  // Explicitly encrypt sensitive fields
  const encryptedFields = await encryptBalanceFields(userId, accountId, balance);
  
  // Separate query fields from update fields to avoid MongoDB conflict
  const { 
    userId: _userId, 
    accountId: encryptedAccountId, 
    balanceType: _balanceType, 
    referenceDate: _referenceDate, 
    ...updateFields 
  } = encryptedFields;
  
  // Filter out null values
  const filteredUpdateFields: any = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== null && value !== undefined) {
      filteredUpdateFields[key] = value;
    }
  }
  
  await coll.updateOne(
    { userId, accountId: encryptedAccountId, balanceType, referenceDate },
    {
      $set: filteredUpdateFields,
      $setOnInsert: {
        userId,
        accountId: encryptedAccountId,
        balanceType,
        referenceDate,
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
  const coll = db.collection('transactions_plaid');
  
  const txDescription = transaction.remittanceInformationUnstructured || transaction.additionalInformation || '';
  const counterparty = transaction.creditorName || transaction.debtorName || '';
  const providerTransactionId = transaction.transactionId || transaction.internalTransactionId || '';
  
  // CRITICAL: Categorize on PLAINTEXT data from GoCardless BEFORE encryption
  // This is the raw unencrypted data from GoCardless API
  // suggestCategory uses heuristic rules + OpenAI on this plaintext
  // Then we encrypt and store in MongoDB with the category already assigned
  const category = await suggestCategory(
    txDescription,
    counterparty,
    transaction.transactionAmount?.amount,
    transaction.transactionAmount?.currency
  );
  
  // Explicitly encrypt sensitive fields
  const encryptedFields = await encryptTransactionFields(
    userId,
    accountId,
    transaction,
    category
  );
  
  // Filter out null values (can't encrypt null)
  const doc: any = {};
  for (const [key, value] of Object.entries(encryptedFields)) {
    if (value !== null && value !== undefined) {
      doc[key] = value;
    }
  }
  
  try {
    await coll.insertOne(doc);
  } catch (e: any) {
    // Handle duplicate key errors silently
    if (e.code === 11000) {
      console.log(`Transaction ${providerTransactionId} already exists, skipping`);
    } else {
      throw e;
    }
  }
}

