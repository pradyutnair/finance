# MongoDB Atlas Queryable Encryption - Complete Setup Guide

This guide walks you through setting up MongoDB Atlas with Queryable Encryption for your Nexpass application step by step.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: MongoDB Atlas Setup](#part-1-mongodb-atlas-setup)
3. [Part 2: Enable Queryable Encryption](#part-2-enable-queryable-encryption)
4. [Part 3: Generate Encryption Keys](#part-3-generate-encryption-keys)
5. [Part 4: Install Dependencies](#part-4-install-dependencies)
6. [Part 5: Create MongoDB Client](#part-5-create-mongodb-client)
7. [Part 6: Define Encryption Schema](#part-6-define-encryption-schema)
8. [Part 7: Update API Routes](#part-7-update-api-routes)
9. [Part 8: Testing](#part-8-testing)
10. [Part 9: Production Deployment](#part-9-production-deployment)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You Need
- MongoDB Atlas account (free tier works for dev)
- Node.js 18+ installed
- Your Nexpass project

### Time Required
- **Setup**: 1 hour
- **Implementation**: 6-7 hours
- **Testing**: 1-2 hours

---

## Part 1: MongoDB Atlas Setup

### Step 1.1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with:
   - Email + password, OR
   - Google account, OR
   - GitHub account
3. Verify your email
4. Complete the welcome survey (optional)

### Step 1.2: Create a New Cluster

1. Click **"Build a Database"**
2. Choose **"Shared"** (free tier) for development
   - For production, choose **M10+** (required for Queryable Encryption)
3. Select **Cloud Provider & Region**:
   - Provider: AWS (recommended)
   - Region: Closest to your users (e.g., us-east-1)
4. Cluster Name: `nexpass-cluster` (or your choice)
5. Click **"Create"** (takes 1-3 minutes)

### Step 1.3: Create Database User

1. Go to **Security → Database Access**
2. Click **"Add New Database User"**
3. Authentication Method: **Password**
4. Username: `nexpass-app` (save this!)
5. Password: Click **"Autogenerate Secure Password"** (save this!)
6. Database User Privileges: **"Read and write to any database"**
7. Click **"Add User"**

**⚠️ IMPORTANT**: Save these credentials securely!
```
Username: nexpass-app
Password: [your-generated-password]
```

### Step 1.4: Configure Network Access

1. Go to **Security → Network Access**
2. Click **"Add IP Address"**
3. For development:
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Add Description: "Development"
4. For production:
   - Add your server's specific IP address
5. Click **"Confirm"**

### Step 1.5: Get Connection String

1. Go to **Database → Clusters**
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Driver: **Node.js**
5. Version: **5.5 or later**
6. Copy the connection string:
   ```
   mongodb+srv://nexpass-app:<password>@nexpass-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with your actual password
8. Save this connection string!

---

## Part 2: Enable Queryable Encryption

### Step 2.1: Upgrade to M10+ (Production Only)

**For Development**: Skip this step (use local keys)

**For Production**:
1. Go to **Database → Clusters**
2. Click **"⋯" → Edit Configuration**
3. Cluster Tier: Select **M10** or higher
4. Click **"Review Changes"**
5. Click **"Apply Changes"** (will cost ~$0.08/hour = ~$57/month)

**Why M10+?**
- Queryable Encryption with MongoDB Atlas KMS requires M10+
- For dev, we'll use local master keys (works on any tier)

### Step 2.2: Enable Queryable Encryption (M10+ only)

**For M10+ clusters**:
1. Go to **Security → Encryption at Rest**
2. Enable **"Queryable Encryption"**
3. Choose **"MongoDB Atlas Key Management"**
4. Click **"Enable"**

**For Free/M0 clusters** (development):
- Use local Customer Master Keys (we'll configure this in code)
- No Atlas dashboard configuration needed

---

## Part 3: Generate Encryption Keys

### Step 3.1: Create Key Generation Script

Create `scripts/generate-mongo-keys.js`:

```javascript
#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');

console.log('\n🔐 Generating MongoDB Encryption Keys\n');
console.log('='.repeat(60));

// Generate 96-byte Customer Master Key (CMK) for local development
const cmk = crypto.randomBytes(96).toString('base64');

console.log('\n📝 Add these to your .env.local file:\n');
console.log('# MongoDB Atlas Configuration');
console.log('MONGODB_URI=mongodb+srv://nexpass-app:<password>@nexpass-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority');
console.log('MONGODB_DATABASE=nexpass');
console.log('MONGODB_KEY_VAULT_NAMESPACE=encryption.__keyVault');
console.log('\n# Local Customer Master Key (Development Only)');
console.log(`MONGODB_LOCAL_MASTER_KEY=${cmk}`);
console.log('\n' + '='.repeat(60));

console.log('\n⚠️  SECURITY NOTES:');
console.log('   1. NEVER commit the Customer Master Key to git');
console.log('   2. For production, use MongoDB Atlas Key Management');
console.log('   3. Store keys in a secure secret manager');
console.log('   4. Different keys for dev/staging/production\n');

// Save to .env.local.example
const envExample = `
# MongoDB Atlas - Queryable Encryption Configuration

# Connection String
MONGODB_URI=mongodb+srv://nexpass-app:<password>@nexpass-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority

# Database Name
MONGODB_DATABASE=nexpass

# Key Vault Collection (stores Data Encryption Keys)
MONGODB_KEY_VAULT_NAMESPACE=encryption.__keyVault

# Local Customer Master Key (Development Only)
# For production, use MongoDB Atlas Key Management
MONGODB_LOCAL_MASTER_KEY=${cmk}

# Environment
NODE_ENV=development
`.trim();

fs.writeFileSync('.env.local.example', envExample);
console.log('✅ Generated .env.local.example\n');
```

### Step 3.2: Generate Keys

```bash
node scripts/generate-mongo-keys.js
```

### Step 3.3: Configure Environment

Copy the output to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and replace:
- `<password>` with your actual MongoDB password
- Update the cluster URL if different

**⚠️ NEVER commit `.env.local` to git!**

---

## Part 4: Install Dependencies

### Step 4.1: Install MongoDB Packages

```bash
npm install mongodb mongodb-client-encryption
```

**Packages**:
- `mongodb@^6.0.0` - MongoDB Node.js driver
- `mongodb-client-encryption@^6.0.0` - Encryption library

### Step 4.2: Verify Installation

```bash
npm list mongodb mongodb-client-encryption
```

Expected output:
```
nexpass@0.1.0
├── mongodb@6.x.x
└── mongodb-client-encryption@6.x.x
```

---

## Part 5: Create MongoDB Client

### Step 5.1: Create Client File

Create `lib/mongodb/client.ts`:

```typescript
import 'server-only';
import { MongoClient, Db, Collection } from 'mongodb';
import { encryptedFieldsMap } from './encryption-schema';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

interface MongoClientOptions {
  autoEncryption?: {
    keyVaultNamespace: string;
    kmsProviders: {
      local?: {
        key: Buffer;
      };
      aws?: any;
    };
    encryptedFieldsMap?: Record<string, any>;
  };
}

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'nexpass';

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Get Customer Master Key
  const localMasterKey = process.env.MONGODB_LOCAL_MASTER_KEY;
  if (!localMasterKey) {
    throw new Error('MONGODB_LOCAL_MASTER_KEY environment variable is not set');
  }

  // Configure automatic encryption
  const clientOptions: MongoClientOptions = {
    autoEncryption: {
      keyVaultNamespace: process.env.MONGODB_KEY_VAULT_NAMESPACE || 'encryption.__keyVault',
      kmsProviders: {
        local: {
          key: Buffer.from(localMasterKey, 'base64'),
        },
      },
      encryptedFieldsMap,
    },
  };

  // Create client with encryption enabled
  const client = new MongoClient(uri, clientOptions as any);
  await client.connect();

  const db = client.db(dbName);

  console.log('✅ Connected to MongoDB with Queryable Encryption enabled');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function getCollection<T extends Document>(
  collectionName: string
): Promise<Collection<T>> {
  const db = await getDatabase();
  return db.collection<T>(collectionName);
}

export async function closeDatabase() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('Closed MongoDB connection');
  }
}
```

### Step 5.2: Create Types File

Create `lib/mongodb/types.ts`:

```typescript
import { ObjectId } from 'mongodb';

export interface Transaction {
  _id?: ObjectId;
  userId: string;
  accountId: string;
  transactionId: string;
  amount: number;
  currency: string;
  bookingDate: string | null;
  bookingMonth?: string;
  bookingYear?: number;
  bookingWeekday?: string;
  valueDate: string | null;
  status?: string;
  category?: string;
  exclude?: boolean;
  
  // Encrypted fields (marked for encryption in schema)
  description: string;
  counterparty: string;
  merchantName?: string;
  creditorName?: string;
  debtorName?: string;
  remittanceInfo?: string;
  additionalInfo?: string;
  raw?: any;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BankAccount {
  _id?: ObjectId;
  userId: string;
  accountId: string;
  institutionId: string;
  institutionName?: string;
  currency: string;
  status: string;
  
  // Encrypted fields
  accountName?: string;
  iban?: string;
  bban?: string;
  maskedPan?: string;
  ownerName?: string;
  product?: string;
  cashAccountType?: string;
  raw?: any;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BankBalance {
  _id?: ObjectId;
  userId: string;
  accountId: string;
  balanceAmount: number;
  currency: string;
  balanceType: string;
  referenceDate: string;
  
  // Encrypted fields
  balanceDetails?: any;
  raw?: any;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BankConnection {
  _id?: ObjectId;
  userId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  requisitionId?: string;
  logoUrl?: string;
  transactionTotalDays?: number;
  maxAccessValidForDays?: number;
  
  // Encrypted fields
  agreementId?: string;
  accounts?: string[];
  metadata?: any;
  raw?: any;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Requisition {
  _id?: ObjectId;
  userId: string;
  requisitionId: string;
  institutionId: string;
  institutionName?: string;
  status: string;
  createdAt?: Date;
  
  // Encrypted fields
  reference?: string;
  redirectUri?: string;
  agreementId?: string;
  accounts?: string[];
  link?: string;
  raw?: any;
  
  updatedAt?: Date;
}
```

---

## Part 6: Define Encryption Schema

### Step 6.1: Create Encryption Schema

Create `lib/mongodb/encryption-schema.ts`:

```typescript
import 'server-only';

/**
 * Queryable Encryption Schema
 * 
 * Defines which fields should be encrypted and how.
 * 
 * Algorithm options:
 * - "Indexed": Encrypted but queryable (equality queries)
 * - "Unindexed": Encrypted but NOT queryable (maximum security)
 * 
 * Query types:
 * - "equality": Supports equality queries (WHERE field = value)
 * - "rangePreview": Supports range queries (WHERE field > value)
 */

export const encryptedFieldsMap = {
  // Transactions Collection
  'nexpass.transactions': {
    fields: [
      {
        path: 'description',
        bsonType: 'string',
        queries: {
          queryType: 'equality', // Can search by exact description
        },
      },
      {
        path: 'counterparty',
        bsonType: 'string',
        queries: {
          queryType: 'equality', // Can search by exact counterparty
        },
      },
      {
        path: 'merchantName',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'creditorName',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'debtorName',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'remittanceInfo',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'raw',
        bsonType: 'object',
        // Unindexed - maximum security, not queryable
      },
    ],
  },

  // Bank Accounts Collection
  'nexpass.bank_accounts': {
    fields: [
      {
        path: 'accountName',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'iban',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'bban',
        bsonType: 'string',
      },
      {
        path: 'maskedPan',
        bsonType: 'string',
      },
      {
        path: 'ownerName',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },

  // Bank Balances Collection
  'nexpass.bank_balances': {
    fields: [
      {
        path: 'balanceDetails',
        bsonType: 'object',
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },

  // Bank Connections Collection
  'nexpass.bank_connections': {
    fields: [
      {
        path: 'agreementId',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'accounts',
        bsonType: 'array',
      },
      {
        path: 'metadata',
        bsonType: 'object',
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },

  // Requisitions Collection
  'nexpass.requisitions': {
    fields: [
      {
        path: 'reference',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'redirectUri',
        bsonType: 'string',
      },
      {
        path: 'agreementId',
        bsonType: 'string',
        queries: {
          queryType: 'equality',
        },
      },
      {
        path: 'accounts',
        bsonType: 'array',
      },
      {
        path: 'link',
        bsonType: 'string',
      },
      {
        path: 'raw',
        bsonType: 'object',
      },
    ],
  },
};

/**
 * Helper function to create Data Encryption Keys (DEKs)
 * Run this ONCE during setup to create keys for each collection
 */
export async function createDataEncryptionKeys() {
  const { MongoClient } = require('mongodb');
  const { ClientEncryption } = require('mongodb-client-encryption');

  const uri = process.env.MONGODB_URI;
  const keyVaultNamespace = process.env.MONGODB_KEY_VAULT_NAMESPACE || 'encryption.__keyVault';
  const localMasterKey = process.env.MONGODB_LOCAL_MASTER_KEY;

  if (!uri || !localMasterKey) {
    throw new Error('Missing required environment variables');
  }

  const client = new MongoClient(uri);
  await client.connect();

  const encryption = new ClientEncryption(client, {
    keyVaultNamespace,
    kmsProviders: {
      local: {
        key: Buffer.from(localMasterKey, 'base64'),
      },
    },
  });

  const collections = [
    'nexpass.transactions',
    'nexpass.bank_accounts',
    'nexpass.bank_balances',
    'nexpass.bank_connections',
    'nexpass.requisitions',
  ];

  console.log('\n🔑 Creating Data Encryption Keys...\n');

  for (const collection of collections) {
    try {
      const keyId = await encryption.createDataKey('local', {
        keyAltNames: [collection],
      });
      console.log(`✅ Created DEK for ${collection}: ${keyId.toString('base64')}`);
    } catch (error: any) {
      if (error.message.includes('duplicate key')) {
        console.log(`⚠️  DEK for ${collection} already exists`);
      } else {
        throw error;
      }
    }
  }

  await client.close();
  console.log('\n✅ All Data Encryption Keys created successfully\n');
}
```

### Step 6.2: Create DEKs Setup Script

Create `scripts/setup-mongo-encryption.js`:

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function setup() {
  const { createDataEncryptionKeys } = require('../lib/mongodb/encryption-schema.ts');
  
  try {
    await createDataEncryptionKeys();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setup();
```

### Step 6.3: Run Setup

```bash
# This creates Data Encryption Keys in MongoDB
node scripts/setup-mongo-encryption.js
```

Expected output:
```
🔑 Creating Data Encryption Keys...

✅ Created DEK for nexpass.transactions: ...
✅ Created DEK for nexpass.bank_accounts: ...
✅ Created DEK for nexpass.bank_balances: ...
✅ Created DEK for nexpass.bank_connections: ...
✅ Created DEK for nexpass.requisitions: ...

✅ All Data Encryption Keys created successfully
```

---

## Part 7: Update API Routes

### Step 7.1: Example - Transactions Route

Update `app/api/transactions/route.ts`:

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb/client";
import type { Transaction } from "@/lib/mongodb/types";

export async function GET(request: Request) {
  try {
    const user = await requireAuthUser(request) as { $id?: string; id?: string };
    const userId = user.$id || user.id;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0"));

    // Get MongoDB collection (encryption automatic)
    const collection = await getCollection<Transaction>('transactions');

    // Build query
    const query: any = { userId };
    
    if (accountId) {
      query.accountId = accountId;
    }
    
    if (from || to) {
      query.bookingDate = {};
      if (from) query.bookingDate.$gte = from;
      if (to) query.bookingDate.$lte = to;
    }

    // Query database - MongoDB handles decryption automatically!
    const transactions = await collection
      .find(query)
      .sort({ bookingDate: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(query);

    return NextResponse.json({
      ok: true,
      transactions, // Already decrypted!
      total,
    });

  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

**That's it!** Encryption and decryption happen automatically.

---

## Part 8: Testing

### Step 8.1: Test Connection

Create `scripts/test-mongo-connection.js`:

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function test() {
  const { getDatabase, closeDatabase } = require('../lib/mongodb/client.ts');

  try {
    console.log('🔗 Testing MongoDB connection...\n');
    
    const db = await getDatabase();
    
    // Ping database
    await db.admin().ping();
    console.log('✅ Connected to MongoDB successfully');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`📂 Found ${collections.length} collections`);
    
    await closeDatabase();
    console.log('✅ Test completed\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
```

Run:
```bash
node scripts/test-mongo-connection.js
```

### Step 8.2: Test Encryption

Create `scripts/test-encryption.js`:

```javascript
#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function test() {
  const { getCollection } = require('../lib/mongodb/client.ts');

  try {
    console.log('🔐 Testing Queryable Encryption...\n');
    
    const collection = await getCollection('transactions');
    
    // Insert test transaction (auto-encrypted)
    const testDoc = {
      userId: 'test-user',
      accountId: 'test-account',
      transactionId: 'test-txn-' + Date.now(),
      amount: 99.99,
      currency: 'USD',
      bookingDate: '2025-10-02',
      description: 'Test encrypted description', // Will be encrypted!
      counterparty: 'Test Merchant', // Will be encrypted!
    };
    
    console.log('📝 Inserting test document...');
    const result = await collection.insertOne(testDoc);
    console.log(`✅ Inserted with _id: ${result.insertedId}`);
    
    // Query it back (auto-decrypted)
    console.log('\n📖 Querying document...');
    const found = await collection.findOne({ _id: result.insertedId });
    
    if (found) {
      console.log('✅ Found and decrypted document:');
      console.log(`   Description: ${found.description}`);
      console.log(`   Counterparty: ${found.counterparty}`);
    }
    
    // Clean up
    await collection.deleteOne({ _id: result.insertedId });
    console.log('\n🗑️  Cleaned up test document');
    
    console.log('\n✅ Encryption test passed!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
```

Run:
```bash
node scripts/test-encryption.js
```

---

## Part 9: Production Deployment

### Step 9.1: Upgrade to M10+ Cluster

1. Go to MongoDB Atlas Dashboard
2. Clusters → Edit Configuration
3. Select M10 or higher
4. Apply changes

### Step 9.2: Enable MongoDB Atlas Key Management

1. Security → Encryption at Rest
2. Enable Queryable Encryption
3. Choose MongoDB Atlas Key Management
4. Remove `MONGODB_LOCAL_MASTER_KEY` from production env
5. Update connection string

### Step 9.3: Deploy Application

```bash
npm run build
# Deploy to your hosting provider
```

---

## Troubleshooting

### Issue: "MONGODB_URI is not set"
**Solution**: Check `.env.local` has `MONGODB_URI` set

### Issue: "MONGODB_LOCAL_MASTER_KEY is not set"
**Solution**: Run `node scripts/generate-mongo-keys.js` and copy to `.env.local`

### Issue: "MongoServerError: library not found"
**Solution**: Install `mongodb-client-encryption`:
```bash
npm install mongodb-client-encryption
```

### Issue: "Cannot find module 'server-only'"
**Solution**: Install it:
```bash
npm install server-only
```

### Issue: "Connection timeout"
**Solution**: 
1. Check Network Access in Atlas (allow your IP)
2. Check connection string is correct
3. Check firewall isn't blocking port 27017

### Issue: "Fields not encrypting"
**Solution**:
1. Run `node scripts/setup-mongo-encryption.js` to create DEKs
2. Check encryption schema matches your collection names
3. Verify `encryptedFieldsMap` is imported in client.ts

---

## 📞 Additional Resources

- **MongoDB Atlas Docs**: https://www.mongodb.com/docs/atlas/
- **Queryable Encryption**: https://www.mongodb.com/docs/v7.0/core/queryable-encryption/
- **Node.js Driver**: https://www.mongodb.com/docs/drivers/node/current/
- **Support**: https://www.mongodb.com/community/forums/

---

**Status**: ✅ Complete Setup Guide  
**Next**: Start implementing MongoDB client and update routes!
