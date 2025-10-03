# MongoDB Queryable Encryption - 15 Minute Setup

## Setup (Do Once)

### 1. MongoDB Atlas (5 min)
```
1. Create account: https://mongodb.com/cloud/atlas/register
2. Create FREE M0 cluster
3. Create database user (save password!)
4. Allow IP: 0.0.0.0/0
5. Get connection string
```

### 2. Install & Configure (5 min)
```bash
npm install mongodb mongodb-client-encryption

node scripts/setup-mongodb.js
# Copy output to .env.local
# Update MONGODB_URI with your credentials
```

### 3. Test (5 min)
```bash
node scripts/test-mongodb.js
# Should print: ✅ All tests passed!
```

## Usage (In Your Code)

```typescript
import { getDb } from '@/lib/mongodb';

// Write - auto encrypts
const db = await getDb();
await db.collection('transactions').insertOne({
  userId: 'user123',
  description: 'Secret data', // AUTO ENCRYPTED!
});

// Read - auto decrypts
const txns = await db.collection('transactions')
  .find({ userId: 'user123' })
  .toArray();
// Already decrypted!

// Query encrypted fields
const results = await db.collection('transactions')
  .find({ description: 'Secret data' }) // Works!
  .toArray();
```

## Files Created

- `lib/mongodb.ts` - MongoDB client (100 lines)
- `scripts/setup-mongodb.js` - Key generation
- `scripts/test-mongodb.js` - Test encryption
- `app/api/mongodb-test/route.ts` - Example API route

## What's Encrypted

- **Transactions**: description, counterparty, merchantName, raw
- **Bank Accounts**: iban, accountName, ownerName, raw
- **Balances**: raw
- **Connections**: agreementId, raw
- **Requisitions**: reference, redirectUri, raw

All encrypted fields are **queryable** (equality queries work!).

## Next Steps

1. Test: `node scripts/test-mongodb.js`
2. Visit: http://localhost:3000/api/mongodb-test
3. Update routes to use MongoDB instead of Appwrite

That's it! 🎉
