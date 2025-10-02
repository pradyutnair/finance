# 🚀 Encryption Implementation Quick Start

**Time to implement: 1-2 hours**

This guide gets you up and running with end-to-end encryption in the fastest way possible.

---

## 📋 What You Need

Before starting, ensure you have:
- ✅ AWS account with permissions to create KMS keys (or GCP account)
- ✅ Appwrite Console access
- ✅ Node.js 18+ installed
- ✅ This project cloned and dependencies installed

---

## ⚡ 5-Step Quick Setup

### Step 1: Generate Keys (2 minutes)

```bash
node scripts/generate-encryption-keys.js
```

**Save the output** (you'll need it for `.env`):
```
INDEX_KEY_MERCHANT=<save-this>
INDEX_KEY_DESC=<save-this>
```

---

### Step 2: Setup AWS KMS (5 minutes)

**Quick AWS Setup:**
```bash
# Create KMS key
aws kms create-key \
  --description "nexpass-encryption" \
  --region us-east-1

# Save the KeyId from output, then create alias
aws kms create-alias \
  --alias-name alias/nexpass-encryption \
  --target-key-id <KeyId-from-above> \
  --region us-east-1

# Get the ARN
aws kms describe-key \
  --key-id alias/nexpass-encryption \
  --region us-east-1 \
  --query 'KeyMetadata.Arn' \
  --output text
```

**Save the ARN** (format: `arn:aws:kms:us-east-1:123456789012:key/...`)

**Note:** Use your existing AWS credentials or create an IAM user with KMS permissions.

---

### Step 3: Create Appwrite Tables (20 minutes)

Open **Appwrite Console** → Your Database → Create Collection

**Create 6 collections** (use exact IDs):

#### 1. transactions_public
- **ID:** `transactions_public`
- **Document Security:** Enabled
- **Attributes:** 16 total
  ```
  record_id (string, 255, required)
  userId (string, 255, required)
  accountId (string, 255, required)
  transactionId (string, 255, required)
  amount (string, 50, required)
  currency (string, 3, required)
  bookingDate (string, 10, optional)
  bookingMonth (string, 7, optional)
  bookingYear (integer, optional)
  bookingWeekday (string, 3, optional)
  valueDate (string, 10, optional)
  status (string, 50, optional)
  category (string, 255, optional)
  exclude (boolean, optional, default: false)
  merchant_hmac (string, 64, optional)
  desc_hmac (string, 64, optional)
  ```
- **Indexes:**
  - `idx_userId` on `userId`
  - `idx_accountId` on `accountId`
  - `idx_bookingDate` on `bookingDate`
  - `idx_merchant_hmac` on `merchant_hmac`

#### 2-6. Encrypted Tables
Create these 5 collections with **identical structure**:
- `transactions_enc`
- `bank_accounts_enc`
- `bank_balances_enc`
- `bank_connections_enc`
- `requisitions_enc`

**Each has 7 attributes:**
```
record_id (string, 255, required)
userId (string, 255, required)
cipher (string, 100000, required)
dek_wrapped (string, 5000, required)
iv (string, 255, required)
tag (string, 255, required)
enc_version (integer, required, default: 1)
```

**Each has 2 indexes:**
- `idx_record_id` on `record_id`
- `idx_userId` on `userId`

**💡 Tip:** Create one encrypted collection fully, then duplicate it 4 times and just change the ID/name.

---

### Step 4: Configure Environment (3 minutes)

```bash
# Copy example
cp .env.example .env
```

**Edit `.env` and add these lines:**
```env
# Encryption
ENCRYPTION_PROVIDER=aws
ENC_VERSION=1

# AWS KMS
AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/your-key-id
AWS_REGION=us-east-1
# Use your existing AWS credentials (or create new IAM user)

# Blind Index Keys (from Step 1)
INDEX_KEY_MERCHANT=your-generated-key-here
INDEX_KEY_DESC=your-generated-key-here

# Appwrite Collections
APPWRITE_TRANSACTIONS_PUBLIC_COLLECTION_ID=transactions_public
APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID=transactions_enc
APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID=bank_accounts_enc
APPWRITE_BANK_BALANCES_ENC_COLLECTION_ID=bank_balances_enc
APPWRITE_BANK_CONNECTIONS_ENC_COLLECTION_ID=bank_connections_enc
APPWRITE_REQUISITIONS_ENC_COLLECTION_ID=requisitions_enc
```

---

### Step 5: Test (5 minutes)

```bash
# Start dev server
npm run dev

# In another terminal, test encryption
node -e "
const { encryptJson, decryptJson } = require('./lib/crypto/encryption');
(async () => {
  const data = { secret: 'test' };
  const aad = { userId: 'test' };
  const enc = await encryptJson(data, aad);
  console.log('✅ Encrypted:', enc.cipher.slice(0, 50) + '...');
  const dec = await decryptJson(enc, aad);
  console.log('✅ Decrypted:', dec);
  console.log('🎉 Encryption working!');
})();
"
```

**Expected output:**
```
✅ Encrypted: <base64-gibberish>...
✅ Decrypted: { secret: 'test' }
🎉 Encryption working!
```

---

## ✅ You're Done!

Encryption is now active! Here's what happens automatically:

1. **When users link bank accounts:**
   - Sensitive data (IBAN, names) → Encrypted in `bank_accounts_enc`
   - Public data (currency, IDs) → Readable in `bank_accounts_dev`

2. **When transactions sync:**
   - Descriptions, merchants → Encrypted in `transactions_enc`
   - Amounts, dates, categories → Readable in `transactions_public`

3. **When users view data:**
   - API automatically decrypts on read
   - Users see everything normally
   - Data stays encrypted at rest

---

## 🧪 Verify It's Working

### Test 1: Link a Test Bank Account
1. Open your app: `http://localhost:3000`
2. Link a GoCardless sandbox bank
3. Wait for transactions to sync

### Test 2: Check Appwrite Console
1. Open `transactions_public` table
   - ✅ You should see amounts, dates (readable)
   - ❌ No descriptions or merchant names

2. Open `transactions_enc` table
   - ✅ You should see base64 ciphertext in `cipher` field
   - ❌ Cannot read sensitive data

### Test 3: Check Your App
1. View transactions page
   - ✅ All data displays normally
   - ✅ Descriptions and merchants visible
   - ✅ No errors in console

**🎉 If all 3 tests pass, your encryption is working perfectly!**

---

## 📊 What's Encrypted vs. Public

### ✅ Public (Queryable)
- User IDs
- Account IDs
- Transaction amounts
- Currencies
- Dates (booking, value)
- Categories
- Status fields
- Blind indexes (HMAC)

### 🔒 Encrypted (Not Queryable)
- **Transactions:** Descriptions, merchant names, counterparty, raw data
- **Bank Accounts:** IBAN, account names, owner info, raw data
- **Balances:** Detailed balance info, raw data
- **Connections:** Agreement IDs, account lists, metadata
- **Requisitions:** References, redirect URIs, raw data

---

## 🚨 Troubleshooting

### "Missing AWS_KMS_KEY_ARN"
```bash
# Check .env file
cat .env | grep AWS_KMS_KEY_ARN

# Should output: AWS_KMS_KEY_ARN=arn:aws:kms:...
# If empty, add it to .env
```

### "AccessDeniedException"
```bash
# Test KMS access directly
aws kms describe-key --key-id <your-key-arn>

# If this fails, check your AWS credentials:
aws sts get-caller-identity
```

### "Cannot find module 'server-only'"
```bash
npm install server-only
```

### Dev server won't start
```bash
# Check for syntax errors
npm run build

# If build fails, check the error message
```

---

## 💰 What Does This Cost?

### AWS KMS Pricing
- **Key storage:** $1/month
- **API requests:** $0.03 per 10,000 requests

### Example for 10,000 transactions/month
- ~20,000 KMS calls (encrypt + decrypt)
- **Cost:** ~$1.06/month

**With DEK caching (default):**
- ~4,000 KMS calls (80% reduction)
- **Cost:** ~$1.01/month

**Total: ~$1-2/month** 🎉 (Very affordable!)

---

## 🔒 Security Notes

### ✅ DO
- Keep blind index keys secret
- Use different keys for dev/staging/prod
- Monitor KMS costs
- Set up key rotation (every 90 days)
- Back up your data regularly

### ❌ DON'T
- Commit `.env` to git
- Share blind index keys
- Use same keys across environments
- Log decrypted data
- Expose KMS keys in errors

---

## 📈 Next Steps

### Immediate
1. ✅ Test with sandbox bank account
2. ✅ Verify encryption in Appwrite Console
3. ✅ Monitor dev server logs for errors

### This Week
1. Set up staging environment
2. Test with real (test) data
3. Configure monitoring/alerts
4. Review security checklist

### Before Production
1. Create production KMS key
2. Generate new production blind index keys
3. Set up production monitoring
4. Run full test suite
5. Create incident response plan

---

## 📚 Learn More

### Documentation
- **Full Guide:** `ENCRYPTION_IMPLEMENTATION.md`
- **Integration Examples:** `INTEGRATION_EXAMPLES.md`
- **Setup Checklist:** `SETUP_CHECKLIST.md`
- **Schema Details:** `appwrite/ENCRYPTION_SCHEMA.md`

### Architecture
- **Core Module:** `lib/crypto/encryption.ts`
- **Adapters:** `lib/gocardless/adapters.ts`
- **HTTP Wrapper:** `lib/http/withEncryption.ts`
- **Service Layer:** `lib/server/encryption-service.ts`

### External Resources
- [AWS Encryption SDK Docs](https://docs.aws.amazon.com/encryption-sdk/)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [Appwrite Security](https://appwrite.io/docs/advanced/security)

---

## 🎉 Success!

You now have **enterprise-grade end-to-end encryption** protecting your financial data!

### What you achieved in ~1 hour:
- ✅ AES-256-GCM encryption
- ✅ AWS KMS key management
- ✅ Searchable encrypted data
- ✅ Secure, compliant storage
- ✅ Zero user-visible impact

**Questions?** Check `ENCRYPTION_IMPLEMENTATION.md` or `SETUP_CHECKLIST.md`

**Issues?** See troubleshooting section above

---

**🔐 Your data is now encrypted at rest. Well done!**

*Last Updated: October 2, 2025*
