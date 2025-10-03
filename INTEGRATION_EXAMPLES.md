# Integration Examples: Using Encryption in API Routes

This document provides complete examples of how to integrate the encryption system into your Next.js API routes.

## Table of Contents

1. [Basic Route Pattern](#basic-route-pattern)
2. [Transactions Route (GET)](#transactions-route-get)
3. [Transactions Route (POST/Write)](#transactions-route-postwrite)
4. [Bank Accounts Route](#bank-accounts-route)
5. [Requisitions Callback Route](#requisitions-callback-route)
6. [Error Handling](#error-handling)
7. [Migration Strategy](#migration-strategy)

---

## Basic Route Pattern

All encrypted routes should follow this pattern:

```typescript
export const runtime = 'nodejs'; // Required for KMS SDK
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { Client, Databases } from 'appwrite';
import { withEncryption, successResponse, errorResponse } from '@/lib/http/withEncryption';

export async function GET(request: Request) {
  return withEncryption(async (req) => {
    try {
      // 1. Authenticate user
      const user = await requireAuthUser(req);
      const userId = user.$id || user.id;

      // 2. Create Appwrite client
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY!;
      const databases = new Databases(client);

      // 3. Query and decrypt data
      const data = await queryEncryptedData(userId, databases);

      // 4. Return success response
      return successResponse(data);
    } catch (error: any) {
      console.error('Route error:', error);
      return errorResponse('E_INTERNAL', error.message);
    }
  })(request);
}
```

---

## Transactions Route (GET)

### Updated `/app/api/transactions/route.ts`

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { Client, Databases, Query } from 'appwrite';
import { withEncryption, successResponse, errorResponse, queryAndDecrypt, EncryptionRouteConfig } from '@/lib/http/withEncryption';
import { isEncryptionEnabled } from '@/lib/server/encryption-service';

export async function GET(request: Request) {
  return withEncryption(async (req) => {
    try {
      const user = await requireAuthUser(req) as { $id?: string; id?: string };
      const userId = user.$id || user.id;

      const { searchParams } = new URL(req.url);
      const accountId = searchParams.get('accountId');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      const limit = Math.max(1, parseInt(searchParams.get('limit') || '50'));
      const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
      const searchTerm = searchParams.get('search')?.trim() || null;
      const includeExcluded = searchParams.get('includeExcluded') === 'true';

      // Create Appwrite client
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY!;
      const databases = new Databases(client);

      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

      // Check if encryption is enabled
      if (isEncryptionEnabled()) {
        // Use encrypted tables
        const queries: string[] = [Query.equal('userId', userId!)];

        if (accountId) {
          queries.push(Query.equal('accountId', accountId));
        }

        if (from) {
          queries.push(Query.greaterThanEqual('bookingDate', from));
        }

        if (to) {
          queries.push(Query.lessThanEqual('bookingDate', to));
        }

        if (!includeExcluded) {
          queries.push(Query.equal('exclude', false));
        }

        queries.push(Query.limit(limit));
        queries.push(Query.offset(offset));
        queries.push(Query.orderDesc('bookingDate'));

        const config: EncryptionRouteConfig = {
          databases,
          databaseId: DATABASE_ID,
          publicCollectionId: process.env.APPWRITE_TRANSACTIONS_PUBLIC_COLLECTION_ID || 'transactions_public',
          encryptedCollectionId: process.env.APPWRITE_TRANSACTIONS_ENC_COLLECTION_ID || 'transactions_enc',
          userId: userId!,
        };

        const transactions = await queryAndDecrypt(queries, config);

        // Filter by search term if provided (post-decryption)
        let filtered = transactions;
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          filtered = transactions.filter((txn: any) => {
            const desc = (txn.description || '').toLowerCase();
            const counterparty = (txn.counterparty || '').toLowerCase();
            return desc.includes(lowerSearch) || counterparty.includes(lowerSearch);
          });
        }

        return successResponse({
          transactions: filtered,
          total: filtered.length,
        });
      } else {
        // Fallback to old unencrypted tables
        const TRANSACTIONS_COLLECTION_ID = process.env.APPWRITE_TRANSACTIONS_COLLECTION_ID || 'transactions_dev';

        const queries: string[] = [Query.equal('userId', userId!)];
        if (accountId) queries.push(Query.equal('accountId', accountId));
        if (from) queries.push(Query.greaterThanEqual('bookingDate', from));
        if (to) queries.push(Query.lessThanEqual('bookingDate', to));
        if (!includeExcluded) queries.push(Query.equal('exclude', false));
        queries.push(Query.limit(limit));
        queries.push(Query.offset(offset));
        queries.push(Query.orderDesc('bookingDate'));

        const response = await databases.listDocuments(
          DATABASE_ID,
          TRANSACTIONS_COLLECTION_ID,
          queries
        );

        let transactions = response.documents;

        // Filter by search term
        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase();
          transactions = transactions.filter((txn: any) => {
            const desc = (txn.description || '').toLowerCase();
            const counterparty = (txn.counterparty || '').toLowerCase();
            return desc.includes(lowerSearch) || counterparty.includes(lowerSearch);
          });
        }

        return successResponse({
          transactions,
          total: transactions.length,
        });
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      return errorResponse('E_FETCH_TRANSACTIONS', error.message);
    }
  })(request);
}
```

---

## Transactions Route (POST/Write)

### Example: Storing Transaction with Encryption

```typescript
export async function POST(request: Request) {
  return withEncryption(async (req) => {
    try {
      const user = await requireAuthUser(req);
      const userId = user.$id || user.id;

      const body = await req.json();
      const { accountId, gcTransaction, category } = body;

      // Create Appwrite client
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY!;
      const databases = new Databases(client);

      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

      if (isEncryptionEnabled()) {
        // Use encryption service
        const recordId = await storeEncryptedTransaction({
          gcTransaction,
          userId: userId!,
          accountId,
          category,
          databases,
          databaseId: DATABASE_ID,
        });

        return successResponse({ recordId, created: true });
      } else {
        // Fallback to old method
        // ... old unencrypted write logic
        return successResponse({ created: true });
      }
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      return errorResponse('E_CREATE_TRANSACTION', error.message);
    }
  })(request);
}
```

---

## Bank Accounts Route

### Updated `/app/api/accounts/route.ts`

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { Client, Databases, Query } from 'appwrite';
import { withEncryption, successResponse, errorResponse, readEncrypted, EncryptionRouteConfig } from '@/lib/http/withEncryption';
import { isEncryptionEnabled } from '@/lib/server/encryption-service';
import { mergeBankAccountData } from '@/lib/gocardless/adapters';

export async function GET(request: Request) {
  return withEncryption(async (req) => {
    try {
      const user: any = await requireAuthUser(req);
      const userId = user.$id || user.id;

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY!;
      const databases = new Databases(client);

      const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
      const BANK_ACCOUNTS_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNTS_COLLECTION_ID || 'bank_accounts_dev';

      // Fetch public account data (still from bank_accounts_dev)
      const accountsResponse = await databases.listDocuments(
        DATABASE_ID,
        BANK_ACCOUNTS_COLLECTION_ID,
        [Query.equal('userId', userId)]
      );

      if (isEncryptionEnabled()) {
        // Decrypt sensitive fields for each account
        const enrichedAccounts = await Promise.all(
          accountsResponse.documents.map(async (account: any) => {
            try {
              const config: EncryptionRouteConfig = {
                databases,
                databaseId: DATABASE_ID,
                encryptedCollectionId: process.env.APPWRITE_BANK_ACCOUNTS_ENC_COLLECTION_ID || 'bank_accounts_enc',
                userId,
              };

              const sensitiveData = await readEncrypted(account.accountId, config);
              
              // Merge public and sensitive data
              return mergeBankAccountData(account, sensitiveData);
            } catch (err) {
              console.warn(`Failed to decrypt account ${account.accountId}:`, err);
              // Return public data only if decryption fails
              return account;
            }
          })
        );

        return successResponse({ accounts: enrichedAccounts });
      } else {
        // Return unencrypted data
        return successResponse({ accounts: accountsResponse.documents });
      }
    } catch (error: any) {
      console.error('Error fetching accounts:', error);
      return errorResponse('E_FETCH_ACCOUNTS', error.message);
    }
  })(request);
}
```

---

## Requisitions Callback Route

### Updated `/app/api/gocardless/requisitions/[id]/route.ts`

This is the most complex route since it processes multiple entities:

```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { getRequisition, getAccounts, getBalances, getTransactions, getInstitution } from '@/lib/gocardless';
import { Client, Databases, ID } from 'appwrite';
import { 
  storeEncryptedTransaction,
  storeEncryptedBankAccount,
  storeEncryptedBalance,
  storeEncryptedRequisition,
  isEncryptionEnabled 
} from '@/lib/server/encryption-service';
import { suggestCategory, findExistingCategory } from '@/lib/server/categorize';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requisitionId } = await params;

    // Get user ID (either from auth or from reference)
    let userId: string | undefined;
    try {
      const authedUser: any = await requireAuthUser(request);
      userId = authedUser?.$id || authedUser?.id;
    } catch {
      // Parse from reference if not authenticated
      // ... existing reference parsing logic
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unable to determine user' },
        { status: 400 }
      );
    }

    // Get requisition from GoCardless
    const requisition = await getRequisition(requisitionId);

    if (requisition.status !== 'LINKED' || !requisition.accounts?.length) {
      return NextResponse.json({
        ok: true,
        status: requisition.status,
        message: 'Requisition not yet linked',
      });
    }

    // Setup Appwrite
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
    
    client.headers['X-Appwrite-Key'] = process.env.APPWRITE_API_KEY!;
    const databases = new Databases(client);
    const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

    // Get institution metadata
    let institutionMetadata = {};
    try {
      const institution = await getInstitution(requisition.institution_id);
      institutionMetadata = {
        logoUrl: institution.logo,
        transactionTotalDays: institution.transaction_total_days,
        maxAccessValidForDays: institution.max_access_valid_for_days,
      };
    } catch {}

    // Store requisition (encrypted if enabled)
    if (isEncryptionEnabled()) {
      await storeEncryptedRequisition({
        requisition,
        userId,
        databases,
        databaseId: DATABASE_ID,
      });
    } else {
      // Store in old requisitions_dev table
      // ... existing logic
    }

    // Process each account
    for (const accountId of requisition.accounts) {
      try {
        const accountDetails = await getAccounts(accountId);

        // Store account (encrypted if enabled)
        if (isEncryptionEnabled()) {
          await storeEncryptedBankAccount({
            gcAccount: accountDetails,
            userId,
            accountId,
            institutionId: requisition.institution_id,
            institutionName: requisition.institution_name,
            databases,
            databaseId: DATABASE_ID,
          });
        } else {
          // Store in bank_accounts_dev
          // ... existing logic
        }

        // Get and store balances
        const balancesResponse = await getBalances(accountId);
        for (const balance of balancesResponse?.balances || []) {
          if (isEncryptionEnabled()) {
            await storeEncryptedBalance({
              gcBalance: balance,
              userId,
              accountId,
              databases,
              databaseId: DATABASE_ID,
            });
          } else {
            // Store in balances_dev
            // ... existing logic
          }
        }

        // Get and store transactions
        const transactionsResponse = await getTransactions(accountId);
        for (const transaction of transactionsResponse?.transactions?.booked || []) {
          const description = 
            transaction.remittanceInformationUnstructured ||
            transaction.additionalInformation ||
            '';
          
          const existingCategory = await findExistingCategory(
            databases,
            DATABASE_ID,
            isEncryptionEnabled() 
              ? 'transactions_public' 
              : 'transactions_dev',
            userId,
            description
          );

          const category = existingCategory || await suggestCategory(
            description,
            transaction.creditorName || transaction.debtorName || '',
            transaction.transactionAmount?.amount,
            transaction.transactionAmount?.currency
          );

          if (isEncryptionEnabled()) {
            await storeEncryptedTransaction({
              gcTransaction: transaction,
              userId,
              accountId,
              category,
              databases,
              databaseId: DATABASE_ID,
            });
          } else {
            // Store in transactions_dev
            // ... existing logic
          }
        }
      } catch (error) {
        console.error(`Error processing account ${accountId}:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      status: requisition.status,
      accountCount: requisition.accounts.length,
    });
  } catch (error: any) {
    console.error('Error processing requisition:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## Error Handling

### Best Practices

```typescript
// Always wrap in try-catch
try {
  const result = await encryptJson(data, aad);
  return successResponse(result);
} catch (error: any) {
  // Log full error server-side (with request ID)
  console.error('[Route Error]', {
    requestId: randomUUID(),
    error: error.message,
    stack: error.stack,
    // Never log: encryption keys, plaintext sensitive data
  });

  // Return safe error to client
  return errorResponse(
    error.code || 'E_INTERNAL',
    process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'An error occurred'
  );
}
```

### Specific Error Handling

```typescript
import { EncryptionError, DecryptionError } from '@/lib/crypto/encryption';

try {
  // ... encryption operation
} catch (error: any) {
  if (error instanceof EncryptionError) {
    // Handle encryption-specific errors
    return errorResponse('E_ENCRYPTION', 'Failed to encrypt data');
  } else if (error instanceof DecryptionError) {
    // Handle decryption-specific errors
    return errorResponse('E_DECRYPTION', 'Failed to decrypt data');
  } else if (error.code === 'AccessDeniedException') {
    // KMS access denied
    return errorResponse('E_KMS_ACCESS', 'Encryption service unavailable');
  } else {
    // Generic error
    return errorResponse('E_INTERNAL', 'Internal server error');
  }
}
```

---

## Migration Strategy

### Phase 1: Enable Encryption (Dual Write)

```typescript
// Write to both old and new tables
if (isEncryptionEnabled()) {
  // Write to encrypted tables
  await storeEncryptedTransaction({...});
}

// Always write to old tables (for backwards compatibility)
await databases.createDocument(
  DATABASE_ID,
  'transactions_dev',
  ID.unique(),
  {...}
);
```

### Phase 2: Switch Reads

```typescript
// Read from encrypted tables first, fallback to old
if (isEncryptionEnabled()) {
  try {
    return await queryEncryptedTransactions({...});
  } catch (error) {
    console.warn('Encrypted query failed, falling back to dev table');
  }
}

// Fallback to old tables
return await databases.listDocuments(DATABASE_ID, 'transactions_dev', queries);
```

### Phase 3: Stop Dual Write

```typescript
// Only write to encrypted tables
if (isEncryptionEnabled()) {
  await storeEncryptedTransaction({...});
} else {
  throw new Error('Encryption must be enabled');
}
```

---

## Testing Your Integration

### 1. Unit Test

```typescript
import { GET } from './route';

test('GET /api/transactions returns encrypted data', async () => {
  const request = new Request('http://localhost:3000/api/transactions?from=2025-01-01');
  // Mock auth
  // Mock databases

  const response = await GET(request);
  const data = await response.json();

  expect(data.ok).toBe(true);
  expect(data.data.transactions).toBeInstanceOf(Array);
});
```

### 2. Integration Test

```bash
# 1. Start dev server
npm run dev

# 2. Test write
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "test-account", "gcTransaction": {...}}'

# 3. Test read
curl http://localhost:3000/api/transactions?from=2025-01-01 \
  -H "Authorization: Bearer YOUR_JWT"

# 4. Verify data is encrypted in Appwrite Console
# - Check transactions_enc table: cipher should be base64 gibberish
# - Check transactions_public table: amounts and dates visible, no descriptions
```

### 3. Load Test

```typescript
// Test decryption performance
const start = Date.now();

const results = await queryEncryptedTransactions({
  userId,
  from: '2024-01-01',
  to: '2024-12-31',
  limit: 100,
  databases,
  databaseId: DATABASE_ID,
});

const duration = Date.now() - start;
console.log(`Decrypted ${results.length} transactions in ${duration}ms`);
```

---

## Troubleshooting Integration

### "Cannot import server-only module"

- Ensure route files have `export const runtime = 'nodejs'`
- Never import encryption modules in client components

### "KMS key not found"

- Verify `AWS_KMS_KEY_ARN` is correct
- Check AWS credentials have access
- Test KMS access: `aws kms describe-key --key-id YOUR_KEY_ARN`

### "Blind index key missing"

- Run: `node scripts/generate-encryption-keys.js`
- Add generated keys to `.env`

### "Decryption failed"

- Verify AAD matches encryption AAD
- Check userId and recordId are consistent
- Ensure enc_version matches

### Performance Issues

- Enable KMS DEK caching (default in AWS SDK)
- Batch decrypt operations with `Promise.all()`
- Add indexes on bookingDate, userId, accountId

---

**Next Steps:**
1. Follow setup instructions in `ENCRYPTION_IMPLEMENTATION.md`
2. Create encrypted collections in Appwrite Console
3. Update environment variables
4. Test with a single transaction first
5. Gradually migrate existing data
6. Monitor KMS costs and performance

