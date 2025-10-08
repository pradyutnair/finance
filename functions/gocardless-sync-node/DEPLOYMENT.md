# Deployment Guide

## ✅ Tests Passed

Both test suites have passed successfully:

### Test Suite 1: Basic Functionality (`test-seed-data.ts`)
- ✅ Encryption/decryption working
- ✅ Data stored with explicit encryption
- ✅ Plaintext fields queryable
- ✅ Encrypted fields queryable for equality
- ✅ Auto-decryption on read
- ✅ Categorization working

### Test Suite 2: Integration Test (`test-integration.ts`)
- ✅ Bank account seeded and retrieved
- ✅ Sync process executed without errors
- ✅ 3 transactions synced and encrypted
- ✅ 2 balances synced and encrypted
- ✅ All query types working
- ✅ Auto-decryption confirmed

## 🚀 Deployment to Appwrite

### Option 1: Appwrite CLI

```bash
# From project root
cd appwrite/functions/gocardless-sync-node

# No build step needed for JavaScript

# Deploy using Appwrite CLI
appwrite deploy function
```

### Option 2: Manual Deployment

1. **Create Function in Appwrite Console**
   - Runtime: Node.js 18.0+
   - Entrypoint: `src/main.js`
   - Build Commands: `npm install`

2. **Set Environment Variables** (all required):

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=finance_dev
MONGODB_KEY_VAULT_NS=encryption.__keyVault

# GCP KMS (for encryption)
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=global
GCP_KEY_RING=nexpass-keyring
GCP_KEY_NAME=nexpass-key
GCP_EMAIL=service-account@project.iam.gserviceaccount.com
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# GoCardless
GOCARDLESS_SECRET_ID=your-secret-id
GOCARDLESS_SECRET_KEY=your-secret-key

# OpenAI (optional - for AI categorization)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Appwrite (auto-injected by platform)
APPWRITE_FUNCTION_API_ENDPOINT
APPWRITE_FUNCTION_PROJECT_ID
APPWRITE_API_KEY
```

3. **Configure Function Settings**
   - Timeout: 300 seconds (5 minutes)
   - Memory: 512 MB (recommended)
   - Permissions: `any`
   - Execute: Manual trigger or scheduled

4. **Deploy**
   - Upload function files
   - Trigger a test execution
   - Monitor logs for any errors

## 🧪 Running Tests Locally

```bash
# Install dependencies
npm install

# Run basic test suite
node test-seed-data.js

# Run integration test
node test-integration.js

# Both should pass with all ✅ checks
```

## 📊 What Gets Synced

For each user with bank accounts:
1. **Transactions** - Fetched incrementally from last sync date
2. **Balances** - Current account balances (updated/created)

### Encryption Applied
- **Plaintext**: userId, category, exclude, bookingDate, balanceType, referenceDate
- **Deterministic**: accountId, transactionId (equality queries)
- **Random**: amount, description, counterparty, currency, raw data

## 🔍 Monitoring

After deployment, check:
- ✅ Function execution logs
- ✅ Transaction count in MongoDB
- ✅ Balance records updated
- ✅ No errors in encryption/decryption
- ✅ Categories assigned correctly

## 🎯 Next Steps

1. Deploy to Appwrite Cloud Functions
2. Set up scheduled execution (e.g., daily at midnight)
3. Monitor first execution
4. Verify data in MongoDB Atlas
5. Test queries from Next.js app

## ✨ Benefits

- **Serverless Compatible**: No mongocryptd daemon required
- **Auto-Decryption**: Encrypted data automatically decrypted on reads
- **Queryable**: Filter by user, dates, categories without decryption
- **Secure**: GCP KMS manages encryption keys
- **Incremental**: Only fetches new transactions since last sync

