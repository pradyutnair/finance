# GoCardless Sync MongoDB Function

Appwrite Cloud Function to sync GoCardless data to MongoDB with explicit encryption.

## 🚀 Features

- ✅ **Serverless Compatible** - Simple explicit encryption, no shared libraries
- ✅ **Automatic Decryption** - Data auto-decrypted on reads
- ✅ **Queryable** - Filter by userId, dates, categories
- ✅ **Secure** - Sensitive data encrypted with GCP KMS
- ✅ **Auto-Categorization** - Transactions categorized using heuristics + OpenAI

## 📋 Sync Flow

1. Get users from Appwrite
2. Get user's bank accounts from MongoDB
3. Fetch transactions from GoCardless API
4. Encrypt and store in MongoDB

### Encryption Strategy

**Plaintext** (queryable):
- `userId`, `category`, `exclude`, `bookingDate`, `balanceType`, `referenceDate`

**Encrypted (deterministic)** - equality queries:
- `accountId`, `transactionId`

**Encrypted (random)** - maximum security:
- `amount`, `description`, `counterparty`, `currency`, `balanceAmount`

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

# Appwrite (auto-injected)
APPWRITE_FUNCTION_API_ENDPOINT
APPWRITE_FUNCTION_PROJECT_ID
```

## 📦 Dependencies

See `requirements.txt`:
```
appwrite
requests
openai
pymongo>=4.4.0
pymongo[encryption]
python-dotenv
pymongocrypt
```

## 🏗️ Architecture

```
GoCardless API
      ↓
   Plaintext Transaction Data
      ↓
   Categorization (on plaintext)
      ↓
   Explicit Encryption (ClientEncryption.encrypt())
      ↓
   MongoDB Storage (Binary encrypted data)
      ↓
   Read with Automatic Decryption
      ↓
   Next.js API Routes
```

## 📚 Files

- `src/main.py` - Function entrypoint
- `src/mongodb.py` - MongoDB client with explicit encryption
- `src/explicit_encryption.py` - Encryption functions
- `src/utils.py` - Transaction/balance formatting
- `src/gocardless.py` - GoCardless API client
- `src/appwrite_users.py` - Appwrite user management

## 🔐 Security Notes

- Data encrypted before leaving application
- Encryption keys managed by GCP KMS
- Keys never exposed in logs or responses
- Automatic decryption is transparent
- Serverless compatible - no daemon required

## ✨ Deployment

Deploy to **Appwrite Cloud Functions**:

1. Install dependencies from `requirements.txt`
2. Run `src/main.py` on trigger
3. Sync data with explicit encryption
4. Store in MongoDB Atlas
