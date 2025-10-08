/**
 * Appwrite Cloud Function: GoCardless Sync to MongoDB
 * 
 * Flow:
 * 1. Get all users from Appwrite
 * 2. For each user, get their bank accounts from MongoDB (auto-decrypted)
 * 3. For each account, fetch last transaction date
 * 4. Fetch new transactions from GoCardless API
 * 5. Categorize transactions (on plaintext before encryption)
 * 6. Encrypt sensitive fields and store in MongoDB
 */

import 'dotenv/config';
import {
  getDb,
  getUserBankAccounts,
  getLastBookingDate,
  documentExists,
  findBalanceDocument,
  createTransaction,
  createBalance,
  updateBalance,
} from './mongodb.js';
import { getTransactions, getBalances } from './gocardless.js';
import { formatTransactionPayload, formatBalancePayload, generateDocId } from './utils.js';
import { listUserIds } from './appwrite-users.js';

async function main(context) {
  context.log('🚀 Starting GoCardless sync to MongoDB...');

  try {
    // Validate environment variables
    const requiredEnvVars = ['GOCARDLESS_SECRET_ID', 'GOCARDLESS_SECRET_KEY', 'MONGODB_URI'];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`;
      context.error(errorMsg);
      return context.res.json({ success: false, error: errorMsg }, 400);
    }

    context.log('🔧 Initializing GoCardless client...');
    // GoCardless client initialized via getTransactions/getBalances

    context.log('🔍 Connecting to MongoDB...');
    const db = await getDb();
    await db.command({ ping: 1 });
    context.log('✅ MongoDB connected');

    // Fetch users from Appwrite
    context.log('🔍 Fetching users from Appwrite...');
    const userIds = await listUserIds();
    context.log(`👥 Found ${userIds.length} users`);

    if (userIds.length === 0) {
      return context.res.json({ success: true, message: 'No users to sync' });
    }

    let totalTransactions = 0;
    let totalBalances = 0;
    let accountsProcessed = 0;
    const failedAccounts = [];

    for (const [userIndex, userId] of userIds.entries()) {
      context.log(`👤 Processing user ${userIndex + 1}/${userIds.length}: ${userId}`);

      // Get user's bank accounts from MongoDB (fields auto-decrypted)
      const accounts = await getUserBankAccounts(userId);
      context.log(`🏦 Found ${accounts.length} accounts`);

      if (accounts.length === 0) continue;

      for (const [index, account] of accounts.entries()) {
        try {
          const accountId = account.accountId;
          if (!accountId) {
            context.log('⚠️ Account missing accountId, skipping');
            continue;
          }

          accountsProcessed++;
          context.log(`💳 Processing account ${accountsProcessed}: ${accountId}`);

          // Get last booking date for incremental sync
          const lastDate = await getLastBookingDate(userId, accountId);
          if (lastDate) {
            context.log(`📅 Last booking date: ${lastDate}`);
          }

          // Fetch transactions from GoCardless
          const transactionsResponse = await getTransactions(accountId, lastDate);
          const transactions = transactionsResponse?.transactions?.booked || [];
          context.log(`📊 Found ${transactions.length} transactions`);

          // Process and store transactions
          for (const tx of transactions.slice(0, 50)) {
            const docId = generateDocId(
              tx.transactionId || tx.internalTransactionId,
              accountId,
              tx.bookingDate
            );

            // Skip if already exists
            if (await documentExists('transactions_dev', docId)) {
              continue;
            }

            // Format and encrypt transaction
            const payload = await formatTransactionPayload(tx, userId, accountId, docId);
            
            // Store in MongoDB
            await createTransaction(docId, payload);
            totalTransactions++;
          }

          // Fetch balances from GoCardless
          const balancesResponse = await getBalances(accountId);
          const balances = balancesResponse?.balances || [];

          // Process and store balances
          for (const balance of balances) {
            const balanceType = balance.balanceType || 'expected';
            const existingDocId = await findBalanceDocument(userId, accountId, balanceType);

            const [balanceDocId, payload] = await formatBalancePayload(balance, userId, accountId);

            if (existingDocId) {
              // Update existing balance
              await updateBalance(existingDocId, {
                balanceAmount: payload.balanceAmount,
                referenceDate: payload.referenceDate,
                currency: payload.currency,
              });
            } else {
              // Create new balance
              await createBalance(balanceDocId, payload);
            }

            totalBalances++;
          }

          // Rate limiting between accounts
          if (index < accounts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          const errorMsg = `${error.name}: ${error.message}`;
          context.log(`❌ Error: ${errorMsg}`);
          failedAccounts.push({
            userId,
            accountId: account.accountId,
            error: errorMsg,
          });
        }
      }
    }

    context.log(`🎉 Sync completed: ${totalTransactions} transactions, ${totalBalances} balances`);

    return context.res.json({
      success: failedAccounts.length === 0,
      transactionsSynced: totalTransactions,
      balancesSynced: totalBalances,
      accountsProcessed,
      accountsFailed: failedAccounts.length,
      failures: failedAccounts.length > 0 ? failedAccounts : undefined,
    });

  } catch (error) {
    context.error(`💥 Sync failed: ${error}`);
    return context.res.json({ success: false, error: error.message });
  }
}

export default main;

