# End-to-End Encryption Deployment Guide

This guide walks you through deploying the end-to-end encryption system for your Nexpass financial application.

## 🎯 Overview

The encryption system is now **fully implemented** and ready for deployment. It features:

- ✅ Envelope encryption (AES-256-GCM + AWS KMS)
- ✅ Blind indexes for searchable encrypted data
- ✅ Backward-compatible with existing unencrypted data
- ✅ Zero client-side exposure of encryption keys
- ✅ Automatic encryption/decryption in API routes
- ✅ Cached decrypted data for performance

## 📋 Prerequisites

Before deploying, ensure you have:

1. **AWS Account** (or GCP account if using Google Cloud KMS)
2. **Appwrite Project** with admin access
3. **GoCardless Account** (already configured)
4. **Node.js 18+** installed
5. **Appwrite CLI** installed and authenticated

## 🚀 Step 1: Set Up AWS KMS

### Option A: AWS KMS (Recommended)

1. **Create KMS Key**:
   ```bash
   # Via AWS Console:
   # - Go to AWS KMS → Customer managed keys → Create key
   # - Choose "Symmetric" encryption key
   # - Set alias: nexpass-encryption-key
   # - Configure key administrators and users
   # - Copy the ARN
   ```

2. **Create IAM User/Role** with KMS permissions:
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
         "Resource": "arn:aws:kms:REGION:ACCOUNT:key/*"
       }
     ]
   }
   ```

3. **Generate Access Keys** for the IAM user

### Option B: GCP KMS (Alternative)

```bash
# Create keyring
gcloud kms keyrings create nexpass-keyring --location us

# Create key
gcloud kms keys create nexpass-key \
  --keyring nexpass-keyring \
  --location us \
  --purpose encryption

# Grant service account permissions
gcloud kms keys add-iam-policy-binding nexpass-key \
  --keyring nexpass-keyring \
  --location us \
  --member serviceAccount:your-sa@project.iam.gserviceaccount.com \
  --role roles/cloudkms.cryptoKeyEncrypterDecrypter
```

## 🔐 Step 2: Generate Blind Index Keys

```bash
cd /workspace
node scripts/generate-encryption-keys.js
```

**IMPORTANT**: 
- Store these keys securely (AWS Secrets Manager, 1Password, etc.)
- Never commit them to version control
- Use different keys for dev/staging/production

## 📦 Step 3: Deploy Appwrite Schema

The encrypted tables are already configured in `appwrite/appwrite.json`. Deploy them:

```bash
cd /workspace/appwrite

# Login to Appwrite (if not already logged in)
appwrite login

# Deploy the collections
appwrite deploy collection
```

This will create:
- `transactions_enc` - **FULLY** encrypted transaction data (ALL fields)
- `bank_accounts_enc` - Encrypted account details
- `bank_balances_enc` - Encrypted balance data
- `bank_connections_enc` - Encrypted connection metadata
- `requisitions_enc` - Encrypted requisition data

**Note**: Transactions have NO public table - everything is encrypted for maximum security.

**Verify**: Check Appwrite Console to confirm all collections were created with correct attributes and indexes.

## ⚙️ Step 4: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:

```bash
# Enable encryption
ENCRYPTION_PROVIDER=aws  # or 'gcp'
ENC_VERSION=1

# AWS KMS (if using AWS)
AWS_KMS_KEY_ARN=arn:aws:kms:REGION:ACCOUNT:key/KEY-ID
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# Blind index keys (from Step 2)
INDEX_KEY_MERCHANT=<generated-key-from-step-2>
INDEX_KEY_DESC=<generated-key-from-step-2>

# Appwrite encrypted collection IDs
# Note: Transactions are FULLY encrypted - no public table
APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID=transactions_enc
APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID=bank_accounts_enc
APPWRITE_BANK_BALANCES_ENC_COLLECTION_ID=bank_balances_enc
APPWRITE_BANK_CONNECTIONS_ENC_COLLECTION_ID=bank_connections_enc
APPWRITE_REQUISITIONS_ENC_COLLECTION_ID=requisitions_enc
```

## 🧪 Step 5: Test Encryption

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Test the flow**:
   - Connect a test bank account via GoCardless
   - Verify data is encrypted in Appwrite:
     - Check `transactions_enc` table: should see base64 cipher text ONLY
     - **NO** `transactions_public` table - everything is encrypted
   - Verify data is decrypted correctly in the app:
     - View transactions in the dashboard
     - All fields should be visible (decrypted on the server)

4. **Verify encryption in Appwrite Console**:
   ```bash
   # transactions_enc should have:
   # - record_id (transaction ID)
   # - userId (for queries)
   # - cipher (base64 encrypted blob with ALL data)
   # - dek_wrapped (KMS-wrapped key)
   # - iv, tag (AES-GCM metadata)
   
   # Verify: NO plaintext amounts, dates, or descriptions visible
   ```

## 🔍 Step 6: Verify Security

### Check 1: No Plaintext in Database
```bash
# Open Appwrite Console
# Navigate to transactions_enc collection
# Inspect a document
# Verify: cipher field contains unreadable base64 text
# Verify: NO plaintext descriptions/merchants visible
```

### Check 2: No Keys in Client Bundle
```bash
npm run build
# Check build output
# Verify: No AWS credentials in client bundles
# Verify: 'server-only' package prevents client imports
```

### Check 3: KMS Key Usage
```bash
# Check AWS CloudWatch Logs
# Search for KMS API calls (Encrypt, Decrypt, GenerateDataKey)
# Verify: Successful API calls with correct key ARN
```

### Check 4: Query Performance
```bash
# Transactions are fully encrypted - no blind indexes
# Filtering happens after decryption in cache layer
# Performance is acceptable due to 30-minute cache TTL
# Monitor cache load times in server logs
```

## 📊 Step 7: Monitor Performance

### Expected Latencies
- Encryption: ~5-10ms per record (includes KMS call)
- Decryption: ~5-10ms per record (includes KMS call)
- HMAC: <1ms per string
- Batch decryption: ~50-100ms for 10 records (parallelized)

### Monitoring Setup

1. **AWS CloudWatch** (if using AWS KMS):
   ```bash
   # Set up alarms for:
   # - KMS API call volume
   # - KMS API latency (p95 > 100ms)
   # - KMS throttling errors
   ```

2. **Application Logs**:
   ```bash
   # Monitor these log messages:
   # [Cache] Using encrypted collections
   # ✅ Stored encrypted transaction
   # ✅ Stored encrypted bank account
   # [Cache] Loaded X transactions for user Y
   ```

3. **Cost Monitoring**:
   ```bash
   # KMS Costs: ~$0.03 per 10,000 requests
   # Monitor: AWS Cost Explorer → KMS service
   # Set budget alerts if necessary
   ```

## 🔄 Step 8: Migrate Existing Data (Optional)

If you have existing unencrypted data, you can migrate it:

```bash
# TODO: Create migration script
# Script will:
# 1. Read from transactions_dev
# 2. Split into public/sensitive data
# 3. Encrypt sensitive data
# 4. Write to transactions_public + transactions_enc
# 5. Run in batches to avoid timeouts
```

**Note**: Migration script not included yet. Current implementation supports **dual-mode**: reads from both encrypted and unencrypted tables, prioritizing encrypted when available.

## 🎛️ Step 9: Production Deployment

### Pre-Deployment Checklist

- [ ] KMS key created and IAM permissions configured
- [ ] Blind index keys generated and stored securely
- [ ] Environment variables set in production environment
- [ ] Appwrite collections deployed and verified
- [ ] Test connection completed successfully
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place for KMS keys

### Deploy to Production

```bash
# Build the production bundle
npm run build

# Deploy to your hosting provider (Vercel, AWS, etc.)
# Ensure environment variables are set in the hosting platform
```

### Post-Deployment Verification

1. Monitor logs for any encryption/decryption errors
2. Verify KMS API calls in CloudWatch/Stackdriver
3. Test a complete user flow: connect bank → view transactions
4. Check database to ensure encrypted data is being stored
5. Verify blind index queries work correctly

## 🛡️ Security Best Practices

### DO ✅
- Store KMS keys in AWS/GCP, never in code
- Use different blind index keys per environment
- Enable KMS key rotation (automatic in AWS)
- Log encryption failures with request IDs
- Use `server-only` import to prevent client bundling
- Validate AAD (Additional Authenticated Data) on decrypt
- Return generic errors to clients (log details server-side)

### DON'T ❌
- Log plaintext data or encryption keys
- Store DEKs unencrypted in database
- Use the same blind index keys across environments
- Attempt to query encrypted fields directly
- Import encryption modules in client components
- Expose KMS errors to clients
- Skip encryption for "less sensitive" data

## 🐛 Troubleshooting

### Error: "Missing AWS_KMS_KEY_ARN"
- Ensure `.env.local` has `AWS_KMS_KEY_ARN` set
- Check that the key exists in AWS KMS
- Verify AWS credentials have KMS permissions

### Error: "Encryption context mismatch"
- AAD must match between encrypt and decrypt
- Ensure `userId` and `recordId` are consistent
- Check `enc_version` matches

### Error: "AccessDeniedException from KMS"
- IAM user/role lacks KMS permissions
- Key policy doesn't allow the principal
- Check AWS credentials are valid

### Performance Issues
- Enable KMS DEK caching (default in AWS SDK)
- Batch decrypt operations with `Promise.all()`
- Add database indexes on queryable fields
- Consider caching decrypted responses

### Data Not Decrypting
- Check encryption is enabled: `ENCRYPTION_PROVIDER` set
- Verify all environment variables are correct
- Check Appwrite collections exist and have data
- Look for decryption errors in server logs

## 📚 Additional Resources

- [AWS Encryption SDK Documentation](https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Appwrite Security Documentation](https://appwrite.io/docs/advanced/security)

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review error logs with request IDs
3. Check AWS CloudWatch (for KMS errors)
4. Review `/workspace/ENCRYPTION_IMPLEMENTATION.md`
5. Check `/workspace/appwrite/ENCRYPTION_SCHEMA.md`

---

**Last Updated**: October 2, 2025  
**Version**: 1.0.0  
**Status**: ✅ Ready for Production Deployment
