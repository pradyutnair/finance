# 🔐 Encryption Setup Checklist

Follow these steps to enable end-to-end encryption for your financial data.

---

## ✅ Pre-Implementation Checklist

### 1. Prerequisites Installed
- [ ] Node.js 18+ installed
- [ ] npm packages installed (`npm install`)
- [ ] AWS CLI installed (if using AWS KMS)
- [ ] Google Cloud SDK installed (if using GCP KMS)
- [ ] Access to Appwrite Console
- [ ] Access to AWS/GCP Console

### 2. Backup Existing Data
- [ ] Export all data from Appwrite (via Console or API)
- [ ] Store backup in secure location
- [ ] Document current schema state
- [ ] Test backup restoration process

---

## 🔑 Step 1: Generate Encryption Keys (5 minutes)

```bash
# Generate blind index keys
node scripts/generate-encryption-keys.js
```

**Output:**
```
INDEX_KEY_MERCHANT=<random-base64-string>
INDEX_KEY_DESC=<random-base64-string>
```

- [ ] Keys generated successfully
- [ ] Keys saved to password manager or secrets vault
- [ ] **DO NOT commit these to git!**

---

## ☁️ Step 2: Setup KMS (15 minutes)

### Option A: AWS KMS

#### 2a. Create KMS Key

**Via AWS Console:**
1. Go to AWS KMS → Customer managed keys
2. Click "Create key"
3. Key type: Symmetric, Encrypt and decrypt
4. Key alias: `nexpass-finance-encryption`
5. Key administrators: Your IAM user/role
6. Key users: Your application's IAM user/role
7. Review and create
8. Copy the ARN (e.g., `arn:aws:kms:us-east-1:123456789012:key/...`)

**Via AWS CLI:**
```bash
aws kms create-key \
  --description "nexpass finance data encryption" \
  --key-usage ENCRYPT_DECRYPT \
  --region us-east-1

# Create alias
aws kms create-alias \
  --alias-name alias/nexpass-finance-encryption \
  --target-key-id <key-id-from-above>
```

- [ ] KMS key created
- [ ] ARN copied: `_______________________________________`

#### 2b. Create IAM User/Role

**Via AWS Console:**
1. Go to IAM → Users → Create user
2. User name: `nexpass-encryption-service`
3. Attach policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/*"
    }
  ]
}
```
4. Create access key
5. Copy Access Key ID and Secret Access Key

- [ ] IAM user created
- [ ] Access Key ID: `_______________________`
- [ ] Secret Access Key: `_______________________` (store securely!)

#### 2c. Test KMS Access

```bash
# Test encryption
aws kms encrypt \
  --key-id <your-key-arn> \
  --plaintext "test" \
  --query CiphertextBlob \
  --output text

# If successful, you'll see base64 ciphertext
```

- [ ] KMS access test successful

### Option B: GCP KMS

#### 2a. Create Key Ring and Key

```bash
# Enable KMS API
gcloud services enable cloudkms.googleapis.com

# Create keyring
gcloud kms keyrings create nexpass-keyring \
  --location us

# Create key
gcloud kms keys create nexpass-encryption-key \
  --keyring nexpass-keyring \
  --location us \
  --purpose encryption
```

- [ ] Key ring created
- [ ] Encryption key created

#### 2b. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create nexpass-encryption-sa \
  --display-name "Nexpass Encryption Service"

# Grant KMS permissions
gcloud kms keys add-iam-policy-binding nexpass-encryption-key \
  --keyring nexpass-keyring \
  --location us \
  --member serviceAccount:nexpass-encryption-sa@PROJECT_ID.iam.gserviceaccount.com \
  --role roles/cloudkms.cryptoKeyEncrypterDecrypter

# Create and download key
gcloud iam service-accounts keys create ~/nexpass-sa-key.json \
  --iam-account nexpass-encryption-sa@PROJECT_ID.iam.gserviceaccount.com
```

- [ ] Service account created
- [ ] Permissions granted
- [ ] Key file downloaded

#### 2c. Test KMS Access

```bash
# Test encryption
gcloud kms encrypt \
  --keyring nexpass-keyring \
  --key nexpass-encryption-key \
  --location us \
  --plaintext-file <(echo "test") \
  --ciphertext-file /tmp/test.enc
```

- [ ] KMS access test successful

---

## 🗄️ Step 3: Create Appwrite Collections (30 minutes)

Open Appwrite Console and create these collections in your database:

### 3a. transactions_public

**Settings:**
- Collection ID: `transactions_public`
- Name: "Transactions (Public)"
- Document Security: ✅ Enabled

**Attributes:** (16 total)
1. `record_id` - String, 255, Required
2. `userId` - String, 255, Required
3. `accountId` - String, 255, Required
4. `transactionId` - String, 255, Required
5. `amount` - String, 50, Required
6. `currency` - String, 3, Required
7. `bookingDate` - String, 10, Optional
8. `bookingMonth` - String, 7, Optional
9. `bookingYear` - Integer, Optional
10. `bookingWeekday` - String, 3, Optional
11. `valueDate` - String, 10, Optional
12. `status` - String, 50, Optional
13. `category` - String, 255, Optional
14. `exclude` - Boolean, Optional, Default: false
15. `merchant_hmac` - String, 64, Optional
16. `desc_hmac` - String, 64, Optional

**Indexes:**
1. `idx_userId` - key on `userId`
2. `idx_accountId` - key on `accountId`
3. `idx_bookingDate` - key on `bookingDate`
4. `idx_merchant_hmac` - key on `merchant_hmac`

**Permissions:**
- Read: `user($userId)`
- Create: `user($userId)`
- Update: `user($userId)`
- Delete: `user($userId)`

- [ ] transactions_public created
- [ ] All 16 attributes added
- [ ] All 4 indexes created
- [ ] Permissions configured

### 3b. transactions_enc

**Settings:**
- Collection ID: `transactions_enc`
- Name: "Transactions (Encrypted)"
- Document Security: ✅ Enabled

**Attributes:** (7 total)
1. `record_id` - String, 255, Required
2. `userId` - String, 255, Required
3. `cipher` - String, 100000, Required
4. `dek_wrapped` - String, 5000, Required
5. `iv` - String, 255, Required
6. `tag` - String, 255, Required
7. `enc_version` - Integer, Required, Default: 1

**Indexes:**
1. `idx_record_id` - key on `record_id`
2. `idx_userId` - key on `userId`

**Permissions:** Same as above

- [ ] transactions_enc created
- [ ] All 7 attributes added
- [ ] Both indexes created
- [ ] Permissions configured

### 3c. bank_accounts_enc

**Settings:**
- Collection ID: `bank_accounts_enc`
- Name: "Bank Accounts (Encrypted)"
- Document Security: ✅ Enabled

**Attributes:** Same 7 as transactions_enc (copy from above)

**Indexes:** Same 2 as transactions_enc

**Permissions:** Same as above

- [ ] bank_accounts_enc created
- [ ] All 7 attributes added
- [ ] Both indexes created
- [ ] Permissions configured

### 3d. bank_balances_enc

Repeat same structure as bank_accounts_enc, but with:
- Collection ID: `bank_balances_enc`
- Name: "Bank Balances (Encrypted)"

- [ ] bank_balances_enc created
- [ ] All 7 attributes added
- [ ] Both indexes created
- [ ] Permissions configured

### 3e. bank_connections_enc

Repeat same structure, but with:
- Collection ID: `bank_connections_enc`
- Name: "Bank Connections (Encrypted)"

- [ ] bank_connections_enc created
- [ ] All 7 attributes added
- [ ] Both indexes created
- [ ] Permissions configured

### 3f. requisitions_enc

Repeat same structure, but with:
- Collection ID: `requisitions_enc`
- Name: "Requisitions (Encrypted)"

- [ ] requisitions_enc created
- [ ] All 7 attributes added
- [ ] Both indexes created
- [ ] Permissions configured

---

## ⚙️ Step 4: Configure Environment (10 minutes)

### 4a. Update .env file

```bash
# Copy example
cp .env.example .env
```

Edit `.env` and fill in:

**Encryption Settings:**
```env
ENCRYPTION_PROVIDER=aws  # or gcp
ENC_VERSION=1
```

**AWS KMS (if using AWS):**
```env
AWS_KMS_KEY_ARN=<from-step-2>
AWS_ACCESS_KEY_ID=<from-step-2>
AWS_SECRET_ACCESS_KEY=<from-step-2>
AWS_REGION=us-east-1
```

**GCP KMS (if using GCP):**
```env
GCP_KMS_KEY_URI=gcp-kms://projects/<project>/locations/us/keyRings/nexpass-keyring/cryptoKeys/nexpass-encryption-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/nexpass-sa-key.json
```

**Blind Index Keys:**
```env
INDEX_KEY_MERCHANT=<from-step-1>
INDEX_KEY_DESC=<from-step-1>
```

**Appwrite Collection IDs:**
```env
APPWRITE_TRANSACTIONS_PUBLIC_COLLECTION_ID=transactions_public
APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID=transactions_enc
APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID=bank_accounts_enc
APPWRITE_BANK_BALANCES_ENC_COLLECTION_ID=bank_balances_enc
APPWRITE_BANK_CONNECTIONS_ENC_COLLECTION_ID=bank_connections_enc
APPWRITE_REQUISITIONS_ENC_COLLECTION_ID=requisitions_enc
```

- [ ] All environment variables configured
- [ ] `.env` added to `.gitignore`
- [ ] Sensitive values stored in password manager

### 4b. Verify Configuration

```bash
# Start dev server
npm run dev

# In another terminal, test encryption
node -e "
const { generateHmacKey } = require('./lib/crypto/encryption');
console.log('HMAC test:', generateHmacKey().slice(0, 20) + '...');
"
```

- [ ] Dev server starts without errors
- [ ] HMAC generation works
- [ ] No "missing environment variable" errors

---

## 🧪 Step 5: Test Implementation (15 minutes)

### 5a. Unit Tests

```bash
# Run encryption tests
npm test lib/crypto/encryption.test.ts
```

**Expected:** All tests pass ✅

- [ ] Encryption/decryption tests pass
- [ ] HMAC tests pass
- [ ] Error handling tests pass

### 5b. Integration Test

**Test Transaction Write:**
1. Open your app in browser
2. Open browser dev tools → Network tab
3. Link a test bank account (use GoCardless sandbox)
4. Wait for callback to complete
5. Check Appwrite Console:
   - `transactions_public` should have entries with readable amounts/dates
   - `transactions_enc` should have entries with base64 gibberish in `cipher`

- [ ] Transaction written to both tables
- [ ] Public data is readable
- [ ] Encrypted data is unreadable ciphertext

**Test Transaction Read:**
1. Navigate to transactions page
2. Verify transactions display correctly
3. Check browser network tab - API should return decrypted data

- [ ] Transactions display correctly
- [ ] Descriptions and merchant names visible
- [ ] No decryption errors in console

### 5c. Manual KMS Test

```bash
# Direct encryption test
node -e "
const { encryptJson, decryptJson } = require('./lib/crypto/encryption');

(async () => {
  const data = { test: 'sensitive data' };
  const aad = { userId: 'test123' };
  
  console.log('Encrypting...');
  const encrypted = await encryptJson(data, aad);
  console.log('Cipher:', encrypted.cipher.slice(0, 50) + '...');
  
  console.log('Decrypting...');
  const decrypted = await decryptJson(encrypted, aad);
  console.log('Decrypted:', decrypted);
  
  console.log('✅ Round-trip successful!');
})();
"
```

- [ ] Encryption successful
- [ ] Decryption successful
- [ ] Round-trip matches original data

---

## 🔄 Step 6: Migrate Existing Data (Optional, varies)

**⚠️ Only do this if you have existing data to migrate**

### 6a. Test Migration

```bash
# Migrate a small batch first (edit script to limit to 10 records)
npx ts-node scripts/migrate-to-encrypted.ts transactions
```

**Check results:**
- [ ] Migration completed without errors
- [ ] Data visible in encrypted tables
- [ ] Decryption works for migrated data

### 6b. Full Migration

```bash
# Migrate all collections
npx ts-node scripts/migrate-to-encrypted.ts all
```

**Monitor:**
- [ ] Progress logs look correct
- [ ] No failures
- [ ] KMS costs reasonable (check AWS/GCP console)

- [ ] All data migrated successfully
- [ ] Verified random sample of records

---

## 🚀 Step 7: Deploy to Production (30 minutes)

### 7a. Staging Deployment

1. Deploy to staging environment
2. Repeat Steps 2-6 for staging
3. Run full test suite
4. Monitor for 24 hours

- [ ] Staging deployment successful
- [ ] All tests pass in staging
- [ ] No errors in logs
- [ ] Performance acceptable

### 7b. Production Deployment

1. Create production KMS key (separate from dev/staging)
2. Generate new blind index keys for production
3. Create Appwrite collections in production database
4. Deploy application code
5. Test with single user/transaction first
6. Monitor closely for first hour

- [ ] Production KMS key created
- [ ] Production blind index keys generated
- [ ] Production Appwrite collections created
- [ ] Application deployed
- [ ] Smoke tests pass
- [ ] No errors in production logs

### 7c. Enable Monitoring

**AWS CloudWatch:**
```bash
# Create custom metrics dashboard
# Monitor: KMS API calls, encryption latency, error rates
```

**Logging:**
- [ ] CloudWatch Logs configured (or equivalent)
- [ ] Error alerts set up
- [ ] KMS cost alerts configured
- [ ] Performance monitoring enabled

---

## 📊 Step 8: Verify Success (10 minutes)

### Final Verification Checklist

**Functionality:**
- [ ] Users can link bank accounts
- [ ] Transactions display correctly
- [ ] Balances display correctly
- [ ] Search works (using blind indexes if implemented)
- [ ] Categorization works
- [ ] No decryption errors

**Security:**
- [ ] Sensitive data encrypted in Appwrite (check console)
- [ ] KMS keys not exposed in logs or errors
- [ ] Blind index keys not in git repo
- [ ] Document-level permissions working
- [ ] Users can't access other users' data

**Performance:**
- [ ] Page load times acceptable (< 2s)
- [ ] API response times acceptable (< 500ms)
- [ ] KMS latency reasonable (< 100ms p95)
- [ ] No timeout errors

**Monitoring:**
- [ ] Logs show successful encryption/decryption
- [ ] No error spikes
- [ ] KMS costs as expected
- [ ] No unusual traffic patterns

---

## 🎉 Success!

Your financial data is now encrypted end-to-end! 🔐

### What You've Achieved:

✅ Enterprise-grade encryption (AES-256-GCM)
✅ Secure key management (KMS)
✅ Searchable encrypted data (blind indexes)
✅ Compliance-ready (GDPR, PCI-DSS friendly)
✅ Low cost (~$1-2/month)
✅ Minimal performance impact

### Next Steps:

1. Document your encryption setup
2. Train team on security best practices
3. Set up key rotation schedule (every 90 days)
4. Monitor KMS costs and usage
5. Review and update security policies
6. Plan for disaster recovery

---

## 🆘 Troubleshooting

### Common Issues

**"Missing AWS_KMS_KEY_ARN"**
- Check `.env` file has the variable
- Verify no typos in variable name
- Restart dev server after updating `.env`

**"AccessDeniedException from KMS"**
- Check IAM permissions
- Verify key policy allows your IAM user/role
- Test KMS access manually with AWS CLI

**"Encryption context mismatch"**
- Ensure userId in encrypt matches decrypt
- Check recordId is consistent
- Verify enc_version matches

**"Cannot find module 'server-only'"**
- Run: `npm install server-only`

**"Appwrite permission denied"**
- Check document-level permissions in Appwrite Console
- Ensure user is authenticated
- Verify userId matches document owner

**Performance issues**
- Enable KMS DEK caching (should be default)
- Add database indexes
- Batch decrypt operations
- Consider response caching

---

## 📞 Support Contacts

- AWS Support: https://aws.amazon.com/support/
- Appwrite Discord: https://appwrite.io/discord
- Project Documentation: See `ENCRYPTION_IMPLEMENTATION.md`

---

**Last Updated:** October 2, 2025
**Version:** 1.0.0

**Congratulations on implementing world-class encryption! 🚀**
