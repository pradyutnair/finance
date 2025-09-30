/**
 * Simplified GoCardless Sync Function (JavaScript version)
 * Fetches transactions and balances for all active bank accounts
 */

const sdk = require('node-appwrite');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

// GoCardless API configuration
const GOCARDLESS_BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';
const DEFAULT_TIMEOUT = 20000;
const MAX_RETRIES = 3;

/**
 * Simple GoCardless client with token caching
 */
class GoCardlessClient {
    constructor(secretId, secretKey) {
        this.secretId = secretId;
        this.secretKey = secretKey;
        this._accessToken = null;
        this._tokenExpiresAt = 0;
    }

    async _getAccessToken() {
        if (this._accessToken && Date.now() / 1000 < this._tokenExpiresAt - 30) {
            return this._accessToken;
        }

        const url = `${GOCARDLESS_BASE_URL}/token/new/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret_id: this.secretId,
                secret_key: this.secretKey,
            }),
        });

        if (!response.ok) {
            throw new Error(`GoCardless auth failed: ${response.statusText}`);
        }

        const tokenData = await response.json();
        this._accessToken = tokenData.access;
        this._tokenExpiresAt = Date.now() / 1000 + tokenData.access_expires;
        return this._accessToken;
    }

    async _request(path, params = null) {
        const token = await this._getAccessToken();
        const headers = { Authorization: `Bearer ${token}` };
        
        let url = `${GOCARDLESS_BASE_URL}${path}`;
        if (params) {
            const queryString = new URLSearchParams(params).toString();
            url += `?${queryString}`;
        }

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(url, { headers });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                if (attempt === MAX_RETRIES - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async getTransactions(accountId, dateFrom = null) {
        const params = dateFrom ? { date_from: dateFrom } : null;
        return this._request(`/accounts/${accountId}/transactions/`, params);
    }

    async getBalances(accountId) {
        return this._request(`/accounts/${accountId}/balances/`);
    }
}

// Helper functions
function generateDocId(transactionId, accountId, bookingDate) {
    const rawKey = transactionId || `${accountId}_${bookingDate}_${Date.now()}`;
    const cleanId = rawKey.toString().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 36);
    return cleanId || `tx_${Date.now()}`;
}

async function getLastBookingDate(databases, databaseId, collectionId, userId, accountId) {
    try {
        const response = await databases.listDocuments(databaseId, collectionId, [
            sdk.Query.equal('userId', userId),
            sdk.Query.equal('accountId', accountId),
            sdk.Query.orderDesc('bookingDate'),
            sdk.Query.limit(1),
        ]);
        
        const docs = response.documents || [];
        return docs.length > 0 ? (docs[0].bookingDate || docs[0].valueDate || null) : null;
    } catch (error) {
        console.log(`Error fetching last booking date: ${error.message}`);
        return null;
    }
}

function loadCategories() {
    return [
        'Groceries', 'Restaurant', 'Education', 'Transport', 'Travel',
        'Shopping', 'Utilities', 'Entertainment', 'Health', 'Income',
        'Miscellaneous', 'Uncategorized', 'Bank Transfer',
    ];
}

async function loadPreviousCategories(databases, databaseId, collectionId, userId) {
    try {
        const response = await databases.listDocuments(databaseId, collectionId, [
            sdk.Query.equal('userId', userId),
            sdk.Query.limit(100),
        ]);
        return (response.documents || []).map(doc => doc.category).filter(Boolean);
    } catch (error) {
        console.log(`❌ Error loading previous categories: ${error.message}`);
        return [];
    }
}

function lazyCategorize(description, counterparty, amount) {
    const text = `${counterparty || ''} ${description || ''}`.toLowerCase();
    if (/restaurant|cafe|coffee|mcdonald|starbucks/.test(text)) return 'Restaurant';
    if (/uber|taxi|fuel|gas|petrol/.test(text)) return 'Transport';
    if (/amazon|store|shopping|mall/.test(text)) return 'Shopping';
    if (/netflix|spotify|entertainment/.test(text)) return 'Entertainment';
    if (/electric|gas|water|internet|rent/.test(text)) return 'Utilities';
    if (/grocery|supermarket|aldi|tesco/.test(text)) return 'Groceries';
    if (parseFloat(amount || 0) > 0 && /salary|payroll|income/.test(text)) return 'Income';
    return 'Uncategorized';
}

async function categorizeTransaction(description, counterparty, amount, databases, databaseId, collectionId, userId) {
    const text = `${description} ${counterparty} ${amount}`.toLowerCase();
    const previousCategories = await loadPreviousCategories(databases, databaseId, collectionId, userId);
    if (previousCategories.includes(text)) {
        console.log(`🔍 Transaction already categorized: ${text}`);
        return text;
    }

    const categories = loadCategories();
    const category = lazyCategorize(description, counterparty, amount);
    if (category !== 'Uncategorized') return category;

    try {
        if (!process.env.OPENAI_API_KEY) return 'Uncategorized';
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: `Reply with exactly one category: ${categories.join(', ')}.` },
                { role: 'user', content: `Counterparty: ${counterparty}\nDescription: ${description}\nAmount: ${amount}` },
            ],
        });
        const aiCategory = response.choices[0].message.content.trim();
        console.log(`Categorized: ${text} as ${aiCategory} via OpenAI`);
        return categories.includes(aiCategory) ? aiCategory : 'Uncategorized';
    } catch (error) {
        console.log(`❌ Error categorizing: ${error.message}`);
        return 'Uncategorized';
    }
}

module.exports = async (context) => {
    context.log('🚀 Starting GoCardless sync...');

    try {
        const client = new sdk.Client()
            .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
            .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);

        const databases = new sdk.Databases(client);
        const gocardless = new GoCardlessClient(
            process.env.GOCARDLESS_SECRET_ID,
            process.env.GOCARDLESS_SECRET_KEY
        );

        const databaseId = process.env.APPWRITE_DATABASE_ID || '68d42ac20031b27284c9';
        const transactionsCollection = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions';
        const bankAccountsCollection = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts';
        const balancesCollection = process.env.APPWRITE_BALANCES_COLLECTION_ID || 'balances';

        const accountsResponse = await databases.listDocuments(databaseId, bankAccountsCollection, [
            sdk.Query.equal('status', 'active'),
            sdk.Query.limit(50),
        ]);
        
        const accounts = accountsResponse.documents || [];
        context.log(`🏦 Found ${accounts.length} active accounts`);
        if (accounts.length === 0) {
            return context.res.json({ success: true, message: 'No accounts to sync' });
        }

        let totalTransactions = 0;
        let totalBalances = 0;

        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            const { accountId, userId } = account;
            context.log(`💳 Processing account ${i + 1}/${accounts.length}: ${accountId}`);

            try {
                const lastDate = await getLastBookingDate(databases, databaseId, transactionsCollection, userId, accountId);
                context.log(lastDate ? `📅 Last transaction: ${lastDate}` : '📅 No previous transactions');

                let transactions = [];
                try {
                    const txResponse = await gocardless.getTransactions(accountId, lastDate);
                    transactions = (txResponse?.transactions?.booked || []);
                    context.log(`📊 Found ${transactions.length} transactions`);
                } catch (error) {
                    context.log(`❌ Error fetching transactions: ${error.message}`);
                    continue;
                }

                for (const tx of transactions.slice(0, 50)) {
                    try {
                        const txId = tx.transactionId || tx.internalTransactionId;
                        const docId = generateDocId(txId, accountId, tx.bookingDate);

                        try {
                            await databases.getDocument(databaseId, transactionsCollection, docId);
                            continue;
                        } catch {}

                        const transactionAmount = tx.transactionAmount || {};
                        const amount = transactionAmount.amount || '0';
                        const description = tx.remittanceInformationUnstructured || tx.additionalInformation || '';
                        const counterparty = tx.creditorName || tx.debtorName || '';

                        const txData = {
                            userId, accountId,
                            transactionId: (txId ? txId.toString() : docId).substring(0, 255),
                            amount: amount.toString(),
                            currency: (transactionAmount.currency || 'EUR').substring(0, 3),
                            bookingDate: tx.bookingDate?.substring(0, 10) || null,
                            valueDate: tx.valueDate?.substring(0, 10) || null,
                            description: description.substring(0, 500),
                            counterparty: counterparty.substring(0, 255),
                            category: await categorizeTransaction(description, counterparty, amount, databases, databaseId, transactionsCollection, userId),
                            raw: JSON.stringify(tx).substring(0, 10000),
                        };

                        await databases.createDocument(databaseId, transactionsCollection, docId, txData);
                        totalTransactions++;
                        context.log(`✅ Stored transaction: ${docId}`);
                    } catch (error) {
                        context.log(`❌ Error storing transaction: ${error.message}`);
                    }
                }

                try {
                    const balanceResponse = await gocardless.getBalances(accountId);
                    const balances = Array.isArray(balanceResponse?.balances) ? balanceResponse.balances : [];

                    for (const balance of balances) {
                        const balanceType = balance.balanceType || 'closingBooked';
                        const referenceDate = balance.referenceDate || new Date().toISOString().split('T')[0];
                        const balanceAmount = balance.balanceAmount || {};
                        const amount = balanceAmount.amount || '0';
                        const balanceDocId = `${accountId}_${balanceType}_${referenceDate}`.substring(0, 36);

                        try {
                            await databases.getDocument(databaseId, balancesCollection, balanceDocId);
                            continue;
                        } catch {}

                        await databases.createDocument(databaseId, balancesCollection, balanceDocId, {
                            userId, accountId,
                            balanceAmount: amount.toString(),
                            currency: (balanceAmount.currency || 'EUR').substring(0, 3),
                            balanceType, referenceDate,
                        });
                        totalBalances++;
                        context.log(`✅ Stored balance: ${balanceDocId}`);
                    }
                } catch (error) {
                    context.log(`❌ Error storing balances: ${error.message}`);
                }

                if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 1000));
            } catch (error) {
                context.log(`❌ Error processing account ${accountId}: ${error.message}`);
            }
        }

        context.log(`🎉 Sync completed: ${totalTransactions} transactions, ${totalBalances} balances`);
        return context.res.json({ success: true, transactionsSynced: totalTransactions, balancesSynced: totalBalances, accountsProcessed: accounts.length });
    } catch (error) {
        context.error(`💥 Sync failed: ${error.message}`);
        return context.res.json({ success: false, error: error.message });
    }
};
