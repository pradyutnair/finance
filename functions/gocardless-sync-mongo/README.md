# GoCardless Sync MongoDB Function (Serverless)

Appwrite Cloud Function to sync GoCardless data to MongoDB with **explicit encryption** for serverless compatibility.

## 🚀 Features

- ✅ **Serverless Compatible** - Uses explicit encryption (no mongocryptd daemon)
- ✅ **Automatic Decryption** - Data automatically decrypted on reads
- ✅ **Queryable** - Filter by userId, dates, categories
- ✅ **Secure** - Sensitive data encrypted with GCP KMS
- ✅ **Auto-Categorization** - Transactions categorized using heuristics + OpenAI

## 📋 What It Syncs

### For each active bank account:
1. **Transactions** - Recent booked transactions
2. **Balances** - Current account balances

### Encryption Strategy

**Plaintext** (queryable/sortable):
- `userId`, `accountId`, `category`, `exclude`, `bookingDate`, `balanceType`, `referenceDate`

**Encrypted (deterministic)** - equality queries:
- `transactionId` - Look up specific transactions

**Encrypted (random)** - maximum security:
- `amount`, `description`, `counterparty`, `currency`, `balanceAmount`, `iban`, etc.

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

## 🎯 How Explicit Encryption Works

### Write Path
```python
# 1. Get plaintext data from GoCardless
transaction = { "amount": "100.00", "description": "Coffee Shop" }

# 2. Categorize on plaintext
category = categorize_transaction(description, counterparty, amount)

# 3. Explicitly encrypt sensitive fields
encrypted_amount = encrypt_random(amount, client_encryption, data_key_id)
encrypted_desc = encrypt_random(description, client_encryption, data_key_id)

# 4. Store with mixed plaintext + encrypted fields
collection.insert_one({
    "userId": user_id,  # Plaintext - needed for queries
    "category": category,  # Plaintext - needed for filtering
    "bookingDate": "2024-01-01",  # Plaintext - needed for sorting
    "amount": encrypted_amount,  # Binary - encrypted
    "description": encrypted_desc  # Binary - encrypted
})
```

### Read Path
```python
# Query using plaintext fields
docs = collection.find({
    "userId": "user123",
    "category": "Restaurants",
    "bookingDate": {"$gte": "2024-01-01"}
})

# Data automatically decrypted!
for doc in docs:
    print(doc["amount"])  # Automatically decrypted to "100.00"
    print(doc["description"])  # Automatically decrypted to "Coffee Shop"
```

## 🎓 Why This Works in Serverless

### Problem with Auto Encryption
- Requires `mongocryptd` daemon running
- Not available in Appwrite Cloud Functions, Vercel, Lambda

### Solution: Explicit Encryption
- ✅ Encrypt in application code (before write)
- ✅ Decrypt automatically (on read)  
- ✅ Only needs `pymongocrypt` library (available in serverless)
- ✅ No daemon required

## 🧪 Testing

```bash
# Local setup
./setup.sh

# Test function
python test_quick.py
```

## 📚 Files

- `src/main.py` - Function entrypoint
- `src/mongodb.py` - MongoDB client with explicit encryption
- `src/explicit_encryption.py` - Encryption helper functions
- `src/utils.py` - Transaction/balance formatting with encryption
- `src/gocardless.py` - GoCardless API client
- `src/appwrite_users.py` - Appwrite user listing

## 🔐 Security Notes

- Data encrypted before leaving application
- Encryption keys managed by GCP KMS
- Keys never exposed in logs or responses
- Automatic decryption is transparent
- Serverless compatible - no daemon required

## ✨ Deployment

This function is designed for **Appwrite Cloud Functions** with pure Python runtime (no Docker).

Simply push to Appwrite and it will:
1. Install dependencies from `requirements.txt`
2. Run `src/main.py` on trigger
3. Sync data with explicit encryption
4. Store securely in MongoDB Atlas
