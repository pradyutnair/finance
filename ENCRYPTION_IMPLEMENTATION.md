# End-to-End Encryption Implementation Guide

This document describes the complete end-to-end encryption implementation for financial data in the nexpass application.

## 🎯 Overview

We've implemented **envelope encryption** using AES-256-GCM with AWS KMS (or Google Cloud KMS) to protect sensitive financial data while maintaining queryability for analytics and filtering.

### What's Encrypted

- **Transactions**: Descriptions, merchant names, counterparty details, raw transaction data
- **Bank Accounts**: IBAN, account names, owner information, raw account details
- **Bank Balances**: Detailed balance metadata, raw balance data
- **Bank Connections**: Agreement IDs, account lists, metadata
- **Requisitions**: References, redirect URIs, account lists

### What's NOT Encrypted (Queryable)

- User IDs
- Account IDs
- Transaction amounts and currencies
- Booking dates and derived time fields (month, year, weekday)
- Transaction categories and status
- Blind indexes (HMAC) for merchant and description searches

## 📁 Project Structure

```
lib/
├── crypto/
│   └── encryption.ts          # Core encryption module (AES-GCM + KMS)
├── gocardless/
│   └── adapters.ts             # Data adapters (public vs sensitive)
├── http/
│   └── withEncryption.ts       # HTTP wrapper for encrypted routes
└── server/
    └── encryption-service.ts   # High-level encryption service layer

appwrite/
├── appwrite.json               # Appwrite configuration
├── ENCRYPTION_SCHEMA.md        # Database schema documentation
└── schema.md                   # Original schema

scripts/
└── generate-encryption-keys.js # Generate blind index keys

.env.example                    # Environment variables template
```

## 🚀 Setup Instructions

### 1. Generate Encryption Keys

```bash
node scripts/generate-encryption-keys.js
```

This will generate:
- `INDEX_KEY_MERCHANT`: For merchant name blind indexes
- `INDEX_KEY_DESC`: For description blind indexes

**⚠️ CRITICAL**: Store these keys securely and never commit to version control!

### 2. Configure AWS KMS (or GCP KMS)

#### AWS KMS Setup

1. Create a KMS key in AWS Console:
   - Go to AWS KMS → Customer managed keys → Create key
   - Choose symmetric encryption key
   - Set key alias (e.g., `nexpass-encryption-key`)
   - Configure key administrators and users
   - Copy the ARN (e.g., `arn:aws:kms:us-east-1:123456789012:key/...`)

2. Create an IAM user or role with KMS permissions:
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

3. Add to `.env`:
   ```env
   ENCRYPTION_PROVIDER=aws
   AWS_KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/...
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   AWS_REGION=us-east-1
   ```

#### GCP KMS Setup (Alternative)

1. Create a keyring and key in Google Cloud Console:
   ```bash
   gcloud kms keyrings create nexpass-keyring --location us
   gcloud kms keys create nexpass-key \
     --keyring nexpass-keyring \
     --location us \
     --purpose encryption
   ```

2. Grant service account permissions:
   ```bash
   gcloud kms keys add-iam-policy-binding nexpass-key \
     --keyring nexpass-keyring \
     --location us \
     --member serviceAccount:your-sa@project.iam.gserviceaccount.com \
     --role roles/cloudkms.cryptoKeyEncrypterDecrypter
   ```

3. Add to `.env`:
   ```env
   ENCRYPTION_PROVIDER=gcp
   GCP_KMS_KEY_URI=gcp-kms://projects/my-project/locations/us/keyRings/nexpass-keyring/cryptoKeys/nexpass-key
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

### 3. Create Appwrite Collections

Use the Appwrite Console to create the following collections (refer to `appwrite/ENCRYPTION_SCHEMA.md` for detailed schemas):

1. **transactions_public** - Queryable transaction metadata
2. **transactions_enc** - Encrypted transaction data
3. **bank_accounts_enc** - Encrypted account details
4. **bank_balances_enc** - Encrypted balance data
5. **bank_connections_enc** - Encrypted connection metadata
6. **requisitions_enc** - Encrypted requisition data

**Important**: Set document-level permissions so users can only access their own data:
- Read: `user($userId)`
- Create: `user($userId)`
- Update: `user($userId)`
- Delete: `user($userId)`

### 4. Update Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Required variables:
- `ENCRYPTION_PROVIDER`: `aws` or `gcp`
- `AWS_KMS_KEY_ARN` or `GCP_KMS_KEY_URI`
- AWS credentials (if using AWS)
- `INDEX_KEY_MERCHANT` and `INDEX_KEY_DESC`
- `ENC_VERSION`: `1`
- New collection IDs for encrypted tables

### 5. Test the Implementation

```bash
# Run the test suite (once created)
npm test

# Or test manually by creating a transaction via API
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "...", "amount": "100.00", ...}'
```

## 🔧 How It Works

### Encryption Flow (Write)

1. **API receives data** from GoCardless
2. **Adapters split data** into public (queryable) and sensitive (encrypted) fields
3. **Blind indexes generated** for merchant and description (if applicable)
4. **Sensitive data encrypted**:
   - Generate random 256-bit DEK (Data Encryption Key)
   - Encrypt JSON with AES-256-GCM using DEK
   - Wrap DEK with KMS KEK (Key Encryption Key)
   - Store: cipher, wrapped DEK, IV, auth tag
5. **Data stored**:
   - Public fields → `*_public` table (queryable)
   - Encrypted fields → `*_enc` table (not queryable)
   - Both linked by `record_id`

### Decryption Flow (Read)

1. **API receives query** (filters on public fields only)
2. **Query public table** with filters (date range, amount, category, etc.)
3. **For each result**:
   - Fetch corresponding encrypted record by `record_id`
   - Unwrap DEK using KMS
   - Decrypt ciphertext with DEK
   - Merge public and decrypted sensitive fields
4. **Return merged data** to client

### Blind Index Search

To search by merchant name without decrypting:

1. **Client sends search term**: `"Amazon"`
2. **Server computes HMAC**: `hmacDigest("amazon", "merchant")`
3. **Query public table**: `WHERE merchant_hmac = computed_hmac`
4. **Decrypt matching records** and return

## 📊 Performance Considerations

### Encryption Overhead

- **Encryption**: ~5-10ms per record (includes KMS call)
- **Decryption**: ~5-10ms per record (includes KMS call)
- **Batch operations**: Use `Promise.all()` to parallelize

### Optimization Strategies

1. **KMS Caching**: AWS Encryption SDK caches DEKs locally (configurable)
2. **Batch Queries**: Decrypt multiple records in parallel
3. **Selective Decryption**: Only decrypt fields needed for response
4. **Response Caching**: Cache decrypted responses with TTL
5. **Indexes**: Ensure all queryable fields have database indexes

### Cost Optimization

- **KMS Costs**: ~$0.03 per 10,000 requests
- **Strategy**: Enable DEK caching to reduce KMS calls
- **Monitoring**: Track KMS API usage via CloudWatch/Stackdriver

## 🔒 Security Best Practices

### ✅ DO

- Store KMS keys in AWS/GCP, never in code
- Use different blind index keys per environment
- Enable KMS key rotation (automatic in AWS)
- Log encryption failures with request IDs
- Use `server-only` import to prevent client bundling
- Validate AAD (Additional Authenticated Data) on decrypt
- Return generic errors to clients (log details server-side)

### ❌ DON'T

- Log plaintext data or encryption keys
- Store DEKs unencrypted in database
- Use the same blind index keys across environments
- Attempt to query encrypted fields directly
- Import encryption modules in client components
- Expose KMS errors to clients
- Skip encryption for "less sensitive" data

## 🧪 Testing

### Unit Tests

```typescript
// lib/crypto/encryption.test.ts
import { encryptJson, decryptJson, hmacDigest } from '@/lib/crypto/encryption';

test('encryption round-trip', async () => {
  const data = { secret: 'test data' };
  const aad = { userId: 'user123' };
  
  const encrypted = await encryptJson(data, aad);
  const decrypted = await decryptJson(encrypted, aad);
  
  expect(decrypted).toEqual(data);
});

test('blind index determinism', () => {
  const hmac1 = hmacDigest('Amazon', 'merchant');
  const hmac2 = hmacDigest('amazon', 'merchant'); // normalized
  
  expect(hmac1).toBe(hmac2);
});
```

### Integration Tests

```typescript
// Test full flow: encrypt → store → query → decrypt
test('encrypted transaction flow', async () => {
  // 1. Store encrypted transaction
  const txnId = await storeEncryptedTransaction({
    gcTransaction: mockTransaction,
    userId: 'user123',
    accountId: 'acc456',
    databases,
    databaseId,
  });
  
  // 2. Query transactions
  const results = await queryEncryptedTransactions({
    userId: 'user123',
    from: '2025-01-01',
    to: '2025-12-31',
    databases,
    databaseId,
  });
  
  // 3. Verify decrypted data
  expect(results).toContainEqual(
    expect.objectContaining({
      transactionId: txnId,
      description: mockTransaction.remittanceInformationUnstructured,
    })
  );
});
```

## 🚨 Troubleshooting

### "Missing AWS_KMS_KEY_ARN"

- Ensure `.env` has `AWS_KMS_KEY_ARN` set
- Check that the key exists in AWS KMS
- Verify AWS credentials have KMS permissions

### "Encryption context mismatch"

- AAD must match between encrypt and decrypt
- Ensure `userId` and `recordId` are consistent
- Check `enc_version` matches

### "AccessDeniedException from KMS"

- IAM user/role lacks KMS permissions
- Key policy doesn't allow the principal
- Check AWS credentials are valid

### "Cannot find module 'server-only'"

- Run: `npm install server-only`
- Ensure encryption modules are never imported in client components

### Performance Issues

- Enable KMS DEK caching (default in AWS SDK)
- Batch decrypt operations with `Promise.all()`
- Add database indexes on queryable fields
- Consider caching decrypted responses

## 📈 Monitoring & Alerting

### Key Metrics

1. **Encryption/Decryption Latency**: p50, p95, p99
2. **KMS API Call Volume**: Requests per hour
3. **Encryption Failures**: Count and error codes
4. **Blind Index Collisions**: Should be near zero
5. **Query Performance**: Response times for encrypted queries

### CloudWatch Metrics (AWS)

```typescript
// Log custom metrics
import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch();

await cloudwatch.putMetricData({
  Namespace: 'Nexpass/Encryption',
  MetricData: [
    {
      MetricName: 'EncryptionLatency',
      Value: latencyMs,
      Unit: 'Milliseconds',
    },
  ],
}).promise();
```

### Alerting

- **Encryption failure rate > 1%**: Investigate immediately
- **KMS latency > 100ms (p95)**: Check AWS region/network
- **No KMS calls for 1 hour**: Possible outage or misconfiguration

## 🔄 Migration from Unencrypted Data

### Phase 1: Dual Write (No Downtime)

1. Deploy encryption code
2. Update write paths to store in both old and new tables
3. Reads still use old tables

### Phase 2: Migrate Existing Data

```typescript
// scripts/migrate-to-encrypted.ts
async function migrateTransactions() {
  const oldTransactions = await databases.listDocuments(
    databaseId,
    'transactions_dev',
    [Query.limit(100)]
  );
  
  for (const txn of oldTransactions.documents) {
    await storeEncryptedTransaction({
      gcTransaction: JSON.parse(txn.raw),
      userId: txn.userId,
      accountId: txn.accountId,
      category: txn.category,
      databases,
      databaseId,
    });
  }
}
```

### Phase 3: Switch Reads

1. Update GET routes to read from encrypted tables
2. Keep fallback to old tables if record not found
3. Monitor error rates

### Phase 4: Deprecate Old Tables

1. After 2 weeks, stop writing to old tables
2. Backup old tables
3. Drop old tables

## 📚 Additional Resources

- [AWS Encryption SDK Documentation](https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Appwrite Security Documentation](https://appwrite.io/docs/advanced/security)

## 🤝 Support

For issues or questions:
1. Check this documentation
2. Review error logs with request IDs
3. Check AWS CloudWatch (for KMS errors)
4. Open an issue in the project repository

---

**Last Updated**: October 2, 2025
**Version**: 1.0.0
