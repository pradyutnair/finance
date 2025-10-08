# GoCardless Sync Node.js Function

Appwrite Cloud Function to sync GoCardless data to MongoDB with explicit encryption (Node.js/TypeScript).

## 🚀 Features

- ✅ **Serverless Compatible** - Uses MongoDB explicit encryption with bypass mode
- ✅ **Automatic Decryption** - Data auto-decrypted on reads
- ✅ **Queryable** - Filter by userId, dates, categories (plaintext fields)
- ✅ **Secure** - Sensitive data encrypted with GCP KMS
- ✅ **Auto-Categorization** - Transactions categorized using heuristics + OpenAI

## 📋 Sync Flow

1. Get all users from Appwrite
2. For each user, get their bank accounts from MongoDB (auto-decrypted)
3. For each account, fetch last transaction date
4. Fetch new transactions from GoCardless API (incremental sync)
5. Categorize transactions on plaintext (before encryption)
6. Encrypt sensitive fields and store in MongoDB

## 🔐 Encryption Strategy

**Plaintext** (queryable/sortable):
- `userId`, `category`, `exclude`, `bookingDate`, `balanceType`, `referenceDate`

**Encrypted (deterministic)** - equality queries:
- `accountId`, `transactionId` - AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic

**Encrypted (random)** - maximum security:
- `amount`, `description`, `counterparty`, `currency`, `balanceAmount`, `raw`

## 🔧 Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=finance_dev
MONGODB_KEY_VAULT_NS=encryption.__keyVault

# GCP KMS
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

# Appwrite (auto-injected by Appwrite Functions)
APPWRITE_FUNCTION_API_ENDPOINT
APPWRITE_FUNCTION_PROJECT_ID
APPWRITE_API_KEY
```

## 📦 Dependencies

```json
{
  "dependencies": {
    "node-appwrite": "^13.0.0",
    "mongodb": "^6.0.0",
    "dotenv": "^16.0.0"
  }
}
```

## ⚙️ Configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Runtime           | Node.js (18.0)                    |
| Entrypoint        | `src/main.ts`                     |
| Build Commands    | `npm install && npm run build`    |
| Permissions       | `any`                             |
| Timeout (Seconds) | 300                               |

## 📚 Files

- `src/main.ts` - Function entrypoint
- `src/mongodb.ts` - MongoDB client with explicit encryption
- `src/explicit-encryption.ts` - Encryption helpers
- `src/utils.ts` - Transaction/balance formatting
- `src/gocardless.ts` - GoCardless API client
- `src/categorize.ts` - Transaction categorization
- `src/appwrite-users.ts` - Appwrite user management

## 🔐 How It Works

### Write Path
1. Fetch plaintext data from GoCardless API
2. Categorize on plaintext (description, counterparty, amount)
3. Explicitly encrypt sensitive fields using ClientEncryption.encrypt()
4. Store mixed plaintext + encrypted binary data in MongoDB

### Read Path
1. Query using plaintext fields (userId, category, dates)
2. MongoDB driver automatically decrypts encrypted fields
3. Return fully decrypted data to client

### Why Serverless Compatible
- ✅ Uses `bypassAutoEncryption: true` mode
- ✅ No `mongocryptd` daemon required
- ✅ Only needs `mongodb` npm package with encryption support
- ✅ Works in Appwrite Functions, Vercel, AWS Lambda

## ✨ Deployment

Deploy to Appwrite Cloud Functions:

```bash
# From appwrite directory
appwrite deploy function gocardless-sync-node
```

Or manually:
1. Create function in Appwrite Console
2. Set runtime to Node.js 18+
3. Set entrypoint to `src/main.ts`
4. Add environment variables
5. Deploy

