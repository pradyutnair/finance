# MongoDB Queryable Encryption - Simple Setup (15 minutes)

## Quick Start

### 1. Create MongoDB Atlas Account (5 min)
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up (free)
3. Create M0 FREE cluster
4. Create database user (save password!)
5. Allow access from anywhere (0.0.0.0/0)
6. Get connection string

### 2. Install & Configure (5 min)
```bash
npm install mongodb mongodb-client-encryption

# Generate local master key
node scripts/setup-mongodb.js

# Copy output to .env.local
```

### 3. Test (5 min)
```bash
# Test connection
node scripts/test-mongodb.js

# Done! Encryption works automatically
```

## Environment Variables (.env.local)

```env
# MongoDB Atlas FREE tier connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

# Auto-generated local master key (96 bytes)
MONGODB_LOCAL_MASTER_KEY=<generated-base64-key>

# Database name
MONGODB_DATABASE=nexpass
```

## How It Works

**Automatic encryption** - MongoDB driver handles everything:

```typescript
// Write - auto encrypts sensitive fields
await db.collection('transactions').insertOne({
  userId: 'user123',
  amount: 100,
  description: 'Secret purchase', // AUTO ENCRYPTED!
});

// Read - auto decrypts
const txn = await db.collection('transactions').findOne({ userId: 'user123' });
console.log(txn.description); // AUTO DECRYPTED!

// Query encrypted fields
const results = await db.collection('transactions')
  .find({ description: 'Secret purchase' }) // Works on encrypted field!
  .toArray();
```

## That's It!

- ✅ FREE tier
- ✅ Auto encryption/decryption
- ✅ Queryable encrypted fields
- ✅ No complex code

All sensitive fields are encrypted automatically by the MongoDB driver.
