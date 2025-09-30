I'll get the schemas for the development tables (ending with `_dev`) and the `users_private` table, then create a comprehensive markdown documentation.
UpdateTodos: 7 items
Let me start by getting the users_private table schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id users_private --json
```

**Output:**
```
{
  "total": 4,
  "attributes": [
    {
      "key": "role",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-24T17:32:11.955+00:00",
      "$updatedAt": "2025-09-24T17:32:12.215+00:00",
      "size": 6,
      "default": "user",
      "encrypt": false
    },
    {
      "key": "email",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-24T19:54:48.150+00:00",
      "$updatedAt": "2025-09-24T19:54:48.453+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "name",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-24T19:54:55.703+00:00",
      "$updatedAt": "2025-09-24T19:54:55.934+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-24T20:35:40.547+00:00",
      "$updatedAt": "2025-09-24T20:35:40.689+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    }
  ]
}
```

MarkAsCompleted: 1 items
Now let me get the requisitions_dev schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id requisitions_dev --json
```

**Output:**
```
{
  "total": 7,
  "attributes": [
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:26.277+00:00",
      "$updatedAt": "2025-09-25T07:14:26.524+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "requisitionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:26.618+00:00",
      "$updatedAt": "2025-09-25T07:14:26.855+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:26.966+00:00",
      "$updatedAt": "2025-09-25T07:14:27.185+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionName",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:27.311+00:00",
      "$updatedAt": "2025-09-25T07:14:27.549+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "status",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:27.653+00:00",
      "$updatedAt": "2025-09-25T07:14:27.905+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "reference",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:27.997+00:00",
      "$updatedAt": "2025-09-25T07:14:28.236+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "redirectUri",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:39:59.039+00:00",
      "$updatedAt": "2025-09-25T07:41:04.462+00:00",
      "size": 500,
      "default": null,
      "encrypt": false
    }
  ]
}
```

MarkAsCompleted: 1 items
Now let me get the bank_connections_dev schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id bank_connections_dev --json
```

**Output:**
```
{
  "total": 8,
  "attributes": [
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:35.409+00:00",
      "$updatedAt": "2025-09-25T07:14:35.659+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:35.746+00:00",
      "$updatedAt": "2025-09-25T07:14:35.982+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionName",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:36.083+00:00",
      "$updatedAt": "2025-09-25T07:14:36.324+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "status",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:36.420+00:00",
      "$updatedAt": "2025-09-25T07:14:36.639+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "requisitionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:36.758+00:00",
      "$updatedAt": "2025-09-25T07:14:36.967+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "logoUrl",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-27T11:12:10.974+00:00",
      "$updatedAt": "2025-09-27T11:12:11.116+00:00",
      "format": "url",
      "default": null
    },
    {
      "key": "transactionTotalDays",
      "type": "integer",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-27T11:12:31.779+00:00",
      "$updatedAt": "2025-09-27T11:12:31.895+00:00",
      "min": "-9223372036854775808",
      "max": "9223372036854775807",
      "default": null
    },
    {
      "key": "maxAccessValidforDays",
      "type": "integer",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-27T11:33:21.551+00:00",
      "$updatedAt": "2025-09-27T11:33:21.689+00:00",
      "min": "-9223372036854775808",
      "max": "9223372036854775807",
      "default": null
    }
  ]
}
```

MarkAsCompleted: 1 items
Now let me get the bank_accounts_dev schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id bank_accounts_dev --json
```

**Output:**
```
{
  "total": 9,
  "attributes": [
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:44.445+00:00",
      "$updatedAt": "2025-09-25T07:14:44.659+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "accountId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:44.788+00:00",
      "$updatedAt": "2025-09-25T07:14:44.992+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:45.122+00:00",
      "$updatedAt": "2025-09-25T07:14:45.334+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "institutionName",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:45.453+00:00",
      "$updatedAt": "2025-09-25T07:14:45.675+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "iban",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:45.796+00:00",
      "$updatedAt": "2025-09-25T07:14:46.018+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "accountName",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:46.135+00:00",
      "$updatedAt": "2025-09-25T07:14:46.348+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "currency",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:46.531+00:00",
      "$updatedAt": "2025-09-25T07:14:46.740+00:00",
      "size": 3,
      "default": null,
      "encrypt": false
    },
    {
      "key": "status",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:46.916+00:00",
      "$updatedAt": "2025-09-25T07:14:47.139+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "raw",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:14:47.354+00:00",
      "$updatedAt": "2025-09-25T07:14:47.568+00:00",
      "size": 10000,
      "default": null,
      "encrypt": false
    }
  ]
}
```

MarkAsCompleted: 1 items
Now let me get the balances_dev schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id balances_dev --json
```

**Output:**
```
{
  "total": 6,
  "attributes": [
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:51.614+00:00",
      "$updatedAt": "2025-09-25T07:14:51.853+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "accountId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:51.961+00:00",
      "$updatedAt": "2025-09-25T07:14:52.177+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "balanceAmount",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:52.291+00:00",
      "$updatedAt": "2025-09-25T07:14:52.505+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "currency",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:52.640+00:00",
      "$updatedAt": "2025-09-25T07:14:52.849+00:00",
      "size": 3,
      "default": null,
      "encrypt": false
    },
    {
      "key": "balanceType",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:52.978+00:00",
      "$updatedAt": "2025-09-25T07:14:53.239+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "referenceDate",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:53.356+00:00",
      "$updatedAt": "2025-09-25T07:14:53.560+00:00",
      "size": 10,
      "default": null,
      "encrypt": false
    }
  ]
}
```

MarkAsCompleted: 1 items
Finally, let me get the transactions_dev schema:

**Command Executed:**
```bash
appwrite databases list-attributes --database-id 68d42ac20031b27284c9 --collection-id transactions_dev --json
```

**Output:**
```
{
  "total": 13,
  "attributes": [
    {
      "key": "userId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:58.672+00:00",
      "$updatedAt": "2025-09-25T07:14:58.912+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "accountId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:59.000+00:00",
      "$updatedAt": "2025-09-25T07:14:59.204+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "transactionId",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:59.325+00:00",
      "$updatedAt": "2025-09-25T07:14:59.541+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "amount",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:14:59.645+00:00",
      "$updatedAt": "2025-09-25T07:14:59.842+00:00",
      "size": 50,
      "default": null,
      "encrypt": false
    },
    {
      "key": "currency",
      "type": "string",
      "status": "available",
      "error": "",
      "required": true,
      "array": false,
      "$createdAt": "2025-09-25T07:15:00.218+00:00",
      "$updatedAt": "2025-09-25T07:15:00.482+00:00",
      "size": 3,
      "default": null,
      "encrypt": false
    },
    {
      "key": "bookingDate",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:00.547+00:00",
      "$updatedAt": "2025-09-25T07:15:00.826+00:00",
      "size": 10,
      "default": null,
      "encrypt": false
    },
    {
      "key": "bookingDateTime",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:00.901+00:00",
      "$updatedAt": "2025-09-25T07:15:01.145+00:00",
      "size": 25,
      "default": null,
      "encrypt": false
    },
    {
      "key": "valueDate",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:01.249+00:00",
      "$updatedAt": "2025-09-25T07:15:01.497+00:00",
      "size": 10,
      "default": null,
      "encrypt": false
    },
    {
      "key": "description",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:01.584+00:00",
      "$updatedAt": "2025-09-25T07:15:01.862+00:00",
      "size": 500,
      "default": null,
      "encrypt": false
    },
    {
      "key": "counterparty",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:01.904+00:00",
      "$updatedAt": "2025-09-25T07:15:02.151+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    },
    {
      "key": "raw",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-25T07:15:02.261+00:00",
      "$updatedAt": "2025-09-25T07:15:02.525+00:00",
      "size": 10000,
      "default": null,
      "encrypt": false
    },
    {
      "key": "exclude",
      "type": "boolean",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-26T22:00:09.616+00:00",
      "$updatedAt": "2025-09-26T22:00:09.973+00:00",
      "default": false
    },
    {
      "key": "category",
      "type": "string",
      "status": "available",
      "error": "",
      "required": false,
      "array": false,
      "$createdAt": "2025-09-26T22:21:44.657+00:00",
      "$updatedAt": "2025-09-26T22:21:44.958+00:00",
      "size": 255,
      "default": null,
      "encrypt": false
    }
  ]
}
```

MarkAsCompleted: 1 items
Now let me create the comprehensive markdown documentation:


**Diff:**
```diff
--- /Users/pradyut.nair/Documents/Projects/finance/nexpass/database_schema.md
+++ /Users/pradyut.nair/Documents/Projects/finance/nexpass/database_schema.md
@@ -0,0 +1,169 @@
+# Database Schema Documentation
+
+This document describes the schema for the finance application database, specifically focusing on development tables (ending with `_dev`) and the `users_private` table.
+
+## Database Overview
+
+- **Database Name**: finance
+- **Database ID**: 68d42ac20031b27284c9
+- **Type**: tablesdb (Appwrite Tables Database)
+
+---
+
+## Table Schemas
+
+### 1. users_private
+
+**Purpose**: Stores private user information and profile data.
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the user |
+| role | string | ❌ | 6 | "user" | ❌ | ❌ | User role (default: user) |
+| email | string | ❌ | 255 | null | ❌ | ❌ | User's email address |
+| name | string | ❌ | 255 | null | ❌ | ❌ | User's display name |
+
+**Relationships**:
+- `userId` links to other tables as a foreign key
+
+---
+
+### 2. requisitions_dev
+
+**Purpose**: Development table for managing bank connection requisitions (authorization requests).
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this requisition |
+| requisitionId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the requisition |
+| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
+| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
+| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the requisition |
+| reference | string | ❌ | 255 | null | ❌ | ❌ | Optional reference identifier |
+| redirectUri | string | ❌ | 500 | null | ❌ | ❌ | URI to redirect after authorization |
+
+**Relationships**:
+- `userId` → `users_private.userId`
+- `requisitionId` → `bank_connections_dev.requisitionId`
+
+---
+
+### 3. bank_connections_dev
+
+**Purpose**: Development table for storing bank connection details and institution metadata.
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this connection |
+| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
+| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
+| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the connection |
+| requisitionId | string | ❌ | 255 | null | ❌ | ❌ | Reference to the originating requisition |
+| logoUrl | string | ❌ | - | null | ❌ | ❌ | URL to institution logo (URL format) |
+| transactionTotalDays | integer | ❌ | - | null | ❌ | ❌ | Total days of transaction history available |
+| maxAccessValidforDays | integer | ❌ | - | null | ❌ | ❌ | Maximum days access token remains valid |
+
+**Relationships**:
+- `userId` → `users_private.userId`
+- `requisitionId` → `requisitions_dev.requisitionId`
+
+---
+
+### 4. bank_accounts_dev
+
+**Purpose**: Development table for storing individual bank account details.
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this account |
+| accountId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the bank account |
+| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
+| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
+| iban | string | ❌ | 50 | null | ❌ | ❌ | International Bank Account Number |
+| accountName | string | ❌ | 255 | null | ❌ | ❌ | Display name for the account |
+| currency | string | ✓ | 3 | null | ❌ | ❌ | Account currency (ISO 3-letter code) |
+| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the account |
+| raw | string | ❌ | 10000 | null | ❌ | ❌ | Raw account data from bank API |
+
+**Relationships**:
+- `userId` → `users_private.userId`
+- `institutionId` → `bank_connections_dev.institutionId`
+
+---
+
+### 5. balances_dev
+
+**Purpose**: Development table for storing account balance information.
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this account |
+| accountId | string | ✓ | 255 | null | ❌ | ❌ | Reference to the bank account |
+| balanceAmount | string | ✓ | 50 | null | ❌ | ❌ | Balance amount as string for precision |
+| currency | string | ✓ | 3 | null | ❌ | ❌ | Balance currency (ISO 3-letter code) |
+| balanceType | string | ✓ | 50 | null | ❌ | ❌ | Type of balance (e.g., available, current) |
+| referenceDate | string | ✓ | 10 | null | ❌ | ❌ | Date of balance reference (YYYY-MM-DD) |
+
+**Relationships**:
+- `userId` → `users_private.userId`
+- `accountId` → `bank_accounts_dev.accountId`
+
+---
+
+### 6. transactions_dev
+
+**Purpose**: Development table for storing bank transaction data.
+
+| Column | Type | Required | Size | Default | Array | Encrypted | Description |
+|--------|------|----------|------|---------|-------|-----------|-------------|
+| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this transaction |
+| accountId | string | ✓ | 255 | null | ❌ | ❌ | Reference to the bank account |
+| transactionId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the transaction |
+| amount | string | ✓ | 50 | null | ❌ | ❌ | Transaction amount as string for precision |
+| currency | string | ✓ | 3 | null | ❌ | ❌ | Transaction currency (ISO 3-letter code) |
+| bookingDate | string | ❌ | 10 | null | ❌ | ❌ | Date transaction was booked (YYYY-MM-DD) |
+| bookingDateTime | string | ❌ | 25 | null | ❌ | ❌ | Full datetime of booking |
+| valueDate | string | ❌ | 10 | null | ❌ | ❌ | Value date of transaction (YYYY-MM-DD) |
+| description | string | ❌ | 500 | null | ❌ | ❌ | Transaction description |
+| counterparty | string | ❌ | 255 | null | ❌ | ❌ | Other party involved in transaction |
+| raw | string | ❌ | 10000 | null | ❌ | ❌ | Raw transaction data from bank API |
+| exclude | boolean | ❌ | - | false | ❌ | ❌ | Whether to exclude from calculations |
+| category | string | ❌ | 255 | null | ❌ | ❌ | Transaction category for organization |
+
+**Relationships**:
+- `userId` → `users_private.userId`
+- `accountId` → `bank_accounts_dev.accountId`
+
+---
+
+## Data Flow & Relationships
+
+```
+users_private (userId)
+    ↓
+requisitions_dev (userId, requisitionId)
+    ↓
+bank_connections_dev (userId, requisitionId, institutionId)
+    ↓
+bank_accounts_dev (userId, institutionId, accountId)
+    ↓
+├── balances_dev (userId, accountId)
+└── transactions_dev (userId, accountId)
+```
+
+## Key Design Decisions
+
+1. **Development Tables**: All `_dev` tables are used for development/testing environments
+2. **String Types for Financial Data**: Amounts and balances use string types to avoid floating-point precision issues
+3. **Flexible Raw Data Storage**: Large `raw` fields store complete API responses for debugging
+4. **User-Centric Design**: All tables include `userId` for data isolation
+5. **Currency Fields**: Consistent 3-character currency codes throughout
+6. **Status Tracking**: Multiple tables include status fields for state management
+
+## Notes
+
+- All tables use Appwrite's built-in `$id`, `$createdAt`, and `$updatedAt` fields
+- The `users_private` table has restrictive permissions (users only)
+- Development tables appear to have more permissive permissions for testing
+- Date fields in development tables use string format for flexibility
+- Large text fields accommodate complete API responses for audit trails

```

