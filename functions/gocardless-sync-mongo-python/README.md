# GoCardless Sync MongoDB Function

Appwrite Cloud Function to sync GoCardless data to MongoDB with application-level encryption.

## 🚀 Features

- ✅ **Serverless Compatible** - Uses Python `cryptography` library (no MongoDB encryption libs)
- ✅ **Encrypted Storage** - Sensitive data encrypted with Fernet (symmetric encryption)
- ✅ **Queryable** - Filter by userId, dates, categories (plaintext fields)
- ✅ **Deterministic Hashing** - accountId/transactionId use SHA256 for equality queries
- ✅ **Auto-Categorization** - Transactions categorized using heuristics + OpenAI

## 📋 Sync Flow

1. Get users from Appwrite
2. Get user's bank accounts from MongoDB
3. Fetch transactions from GoCardless API
4. Encrypt sensitive fields and store in MongoDB

## 🔐 Encryption Strategy

**Plaintext** (queryable/sortable):
- `userId`, `category`, `exclude`, `bookingDate`, `balanceType`, `referenceDate`

**Hashed** (equality queries only):
- `accountId`, `transactionId` - SHA256 deterministic hash

**Encrypted** (Fernet symmetric encryption):
- `amount`, `description`, `counterparty`, `currency`, `balanceAmount`, `raw`

## 🔧 Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=finance_dev

# Encryption (required)
ENCRYPTION_MASTER_KEY=<base64-encoded-32-byte-key>
ENCRYPTION_SALT=<random-salt-string>

# GoCardless
GOCARDLESS_SECRET_ID=your-secret-id
GOCARDLESS_SECRET_KEY=your-secret-key

# Appwrite (auto-injected)
APPWRITE_FUNCTION_API_ENDPOINT
APPWRITE_FUNCTION_PROJECT_ID
```

## 📦 Dependencies

```
appwrite
requests
openai
pymongo>=4.4.0
cryptography
```

## ⚙️ Configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Runtime           | Python (3.9)                      |
| Entrypoint        | `src/main.py`                     |
| Build Commands    | `pip install -r requirements.txt` |
| Permissions       | `any`                             |
| Timeout (Seconds) | 60                                |
