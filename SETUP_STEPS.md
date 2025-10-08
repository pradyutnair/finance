# MongoDB Queryable Encryption Setup - Step by Step

Follow these steps in order to set up MongoDB with GCP KMS Queryable Encryption.

## ✅ Step 1: Verify Environment Variables

Check that your `.env` file contains all required variables:

```bash
# Required for MongoDB
✓ MONGODB_URI
✓ MONGODB_DB (optional, defaults to 'finance_dev')

# Required for GCP KMS
✓ GCP_EMAIL
✓ GCP_PRIVATE_KEY
✓ GCP_PROJECT_ID
✓ GCP_LOCATION
✓ GCP_KEY_RING
✓ GCP_KEY_NAME

# Required for Encryption
✓ SHARED_LIB_PATH

# Backend Selection
✓ DATA_BACKEND=mongodb
```

**Verify GCP_PRIVATE_KEY format:**
```bash
# Should include literal \n characters, not actual newlines
echo $GCP_PRIVATE_KEY | grep '\\n'
```

## ✅ Step 2: Download MongoDB Shared Library

1. Visit: https://www.mongodb.com/docs/manual/core/queryable-encryption/reference/shared-library/#download-the-automatic-encryption-shared-library
2. Download for macOS: `mongo_crypt_v1.dylib`
3. Save to: `/Users/pradyut.nair/Downloads/lib/mongo_crypt_v1.dylib`
4. Verify path in `.env`: `SHARED_LIB_PATH=/Users/pradyut.nair/Downloads/lib/mongo_crypt_v1.dylib`

**Verify download:**
```bash
ls -lh /Users/pradyut.nair/Downloads/lib/mongo_crypt_v1.dylib
# Should show a file ~60-80MB
```

## ✅ Step 3: Create GCP Customer Master Key

If you haven't created a CMK yet:

```bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Create key ring (one-time)
gcloud kms keyrings create finance-encryption \
  --location=global

# Create encryption key (one-time)
gcloud kms keys create finance-data-key \
  --location=global \
  --keyring=finance-encryption \
  --purpose=encryption

# Get key details
gcloud kms keys describe finance-data-key \
  --location=global \
  --keyring=finance-encryption
```

Update your `.env`:
```bash
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=global
GCP_KEY_RING=finance-encryption
GCP_KEY_NAME=finance-data-key
```

## ✅ Step 4: Create GCP Service Account

```bash
# Create service account
gcloud iam service-accounts create finance-encryption-sa \
  --display-name="Finance App Encryption"

# Grant KMS permissions
gcloud kms keys add-iam-policy-binding finance-data-key \
  --location=global \
  --keyring=finance-encryption \
  --member="serviceAccount:finance-encryption-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"

# Create and download key
gcloud iam service-accounts keys create ~/finance-sa-key.json \
  --iam-account=finance-encryption-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

**Extract credentials for `.env`:**
```bash
# Get email
cat ~/finance-sa-key.json | jq -r '.client_email'
# Copy to GCP_EMAIL

# Get private key
cat ~/finance-sa-key.json | jq -r '.private_key'
# Copy to GCP_PRIVATE_KEY (keep the \n characters)
```

## ✅ Step 5: Setup MongoDB Atlas

1. **Create Cluster** (if not exists):
   - Go to: https://cloud.mongodb.com/
   - Create M10+ cluster (Queryable Encryption requires M10+)
   - Choose region close to your app

2. **Enable Queryable Encryption**:
   - Cluster → Configuration → Advanced Options
   - Enable "Queryable Encryption"

3. **Get Connection String**:
   - Cluster → Connect → Connect your application
   - Copy connection string
   - Update `MONGODB_URI` in `.env`

4. **Create Database User**:
   ```
   Username: financeapp
   Password: [generate secure password]
   Roles: readWrite on finance_dev database
   ```

5. **Whitelist IP**:
   - Add your development machine IP
   - For production: Add Vercel/server IPs

## ✅ Step 6: Install Dependencies

```bash
npm install
```

Verify installation:
```bash
npm list mongodb mongodb-client-encryption dotenv
```

Should show:
```
nexpass@0.1.0
├── dotenv@16.3.1
├── mongodb@6.0.0
└── mongodb-client-encryption@6.0.0
```

## ✅ Step 7: Bootstrap MongoDB Collections

Run the setup script:

```bash
npx tsx scripts/mongo/setup-qe.ts
```

**What this does:**
1. Connects to MongoDB with GCP KMS credentials
2. Creates key vault collection (`encryption.__keyVault`)
3. Uses `ClientEncryption.createEncryptedCollection()` for each collection:
   - `requisitions_dev`
   - `bank_connections_dev`
   - `bank_accounts_dev`
   - `transactions_dev`
4. Creates indexes on plaintext and equality-encrypted fields

**Expected Output:**
```
MongoDB Queryable Encryption collections ensured.
```

**Verify in MongoDB Atlas:**
- Database: `finance_dev`
- Collections: Should show 4 collections + `encryption.__keyVault`
- Indexes: Each collection should have indexes on userId, etc.

## ✅ Step 8: Test the Setup

### Test 1: Connect to MongoDB

```bash
# Test connection
node -e "import('dotenv/config').then(() => import('./lib/mongo/client.ts').then(async ({ getDb }) => { const db = await getDb(); console.log('Connected to:', db.databaseName); process.exit(0); }))"
```

Expected: `Connected to: finance_dev`

### Test 2: Insert Test Data

```javascript
import { getDb } from './lib/mongo/client.ts';

const db = await getDb();
const coll = db.collection('transactions_dev');

// Insert test transaction (will be auto-encrypted)
await coll.insertOne({
  userId: 'test-user-123',
  accountId: 'acct-456',
  transactionId: 'tx-789',
  amount: '-25.50',
  currency: 'EUR',
  bookingDate: '2025-10-05',
  description: 'TESCO SUPERMARKET',
  counterparty: 'Tesco',
  category: 'Groceries',
  exclude: false,
  createdAt: new Date().toISOString(),
});

console.log('✅ Test transaction inserted');

// Query it back (will be auto-decrypted)
const found = await coll.findOne({ userId: 'test-user-123' });
console.log('Found:', found);
// Should show decrypted data!
```

### Test 3: Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

### Test 4: Connect Sandbox Bank

1. Login to your app
2. Go to "Link Bank"
3. Select a sandbox institution (e.g., "Revolut Sandbox")
4. Complete auth flow
5. Check MongoDB Atlas → `bank_accounts_dev` collection
6. Fields like `iban`, `accountName` should show as encrypted blobs
7. Fields like `userId`, `institutionId` should be plaintext

### Test 5: Verify Auto-Categorization

```bash
# Trigger auto-categorization
curl -X POST http://localhost:3000/api/transactions/auto-categorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

Expected response:
```json
{
  "ok": true,
  "processed": 15
}
```

## ✅ Step 9: Production Deployment

### Update Production Environment

Add all environment variables to your hosting platform (Vercel, etc.):

```bash
# Vercel CLI
vercel env add MONGODB_URI
vercel env add GCP_EMAIL
vercel env add GCP_PRIVATE_KEY
# ... etc for all GCP and MongoDB vars
vercel env add DATA_BACKEND
# Set value: mongodb
```

### Deploy

```bash
git add .
git commit -m "feat: migrate to MongoDB with GCP KMS queryable encryption"
git push origin main
vercel --prod
```

### Verify Production

1. Check Vercel logs for successful connection
2. Link a real bank account (not sandbox)
3. Verify data appears encrypted in MongoDB Atlas
4. Test transactions API: `GET /api/transactions`
5. Monitor performance in MongoDB Atlas

## ✅ Step 10: Monitor & Maintain

### Daily Monitoring

- **MongoDB Atlas**: Check query performance, encryption overhead
- **GCP KMS**: Monitor encrypt/decrypt API calls
- **Application Logs**: Watch for decryption errors

### Monthly Tasks

- Review GCP KMS costs (charged per encrypt/decrypt operation)
- Optimize queries to reduce KMS calls
- Archive old transactions (>2 years)

### Quarterly Tasks

- Rotate GCP service account keys
- Review data access patterns
- Update MongoDB indexes based on usage

## Rollback Plan

If you need to rollback to Appwrite:

1. **Disable MongoDB**:
   ```bash
   # Remove from .env
   DATA_BACKEND=appwrite
   ```

2. **Restart server**:
   ```bash
   npm run dev
   ```

3. **Legacy code is preserved** in comments - uncomment if needed

## Success Checklist

- [ ] Environment variables configured
- [ ] MongoDB shared library downloaded
- [ ] GCP CMK created and permissions granted
- [ ] Service account key created and added to `.env`
- [ ] MongoDB Atlas cluster created (M10+)
- [ ] Database user created with readWrite access
- [ ] IP whitelist configured
- [ ] Dependencies installed (`npm install`)
- [ ] Collections bootstrapped (`npx tsx scripts/mongo/setup-qe.ts`)
- [ ] Test data inserted and queried successfully
- [ ] Development server starts without errors
- [ ] Sandbox bank account connected successfully
- [ ] Data appears encrypted in MongoDB Atlas
- [ ] Auto-categorization works
- [ ] Production deployment successful

---

**Need Help?** Check `MONGODB_QUICKSTART.md` for detailed documentation.

