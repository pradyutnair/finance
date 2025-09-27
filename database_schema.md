# Database Schema Documentation

This document describes the schema for the finance application database, specifically focusing on development tables (ending with `_dev`) and the `users_private` table.

## Database Overview

- **Database Name**: finance
- **Database ID**: 68d42ac20031b27284c9
- **Type**: tablesdb (Appwrite Tables Database)

---

## Table Schemas

### 1. users_private

**Purpose**: Stores private user information and profile data.

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the user |
| role | string | ❌ | 6 | "user" | ❌ | ❌ | User role (default: user) |
| email | string | ❌ | 255 | null | ❌ | ❌ | User's email address |
| name | string | ❌ | 255 | null | ❌ | ❌ | User's display name |

**Relationships**:
- `userId` links to other tables as a foreign key

---

### 2. requisitions_dev

**Purpose**: Development table for managing bank connection requisitions (authorization requests).

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this requisition |
| requisitionId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the requisition |
| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the requisition |
| reference | string | ❌ | 255 | null | ❌ | ❌ | Optional reference identifier |
| redirectUri | string | ❌ | 500 | null | ❌ | ❌ | URI to redirect after authorization |

**Relationships**:
- `userId` → `users_private.userId`
- `requisitionId` → `bank_connections_dev.requisitionId`

---

### 3. bank_connections_dev

**Purpose**: Development table for storing bank connection details and institution metadata.

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this connection |
| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the connection |
| requisitionId | string | ❌ | 255 | null | ❌ | ❌ | Reference to the originating requisition |
| logoUrl | string | ❌ | - | null | ❌ | ❌ | URL to institution logo (URL format) |
| transactionTotalDays | integer | ❌ | - | null | ❌ | ❌ | Total days of transaction history available |
| maxAccessValidforDays | integer | ❌ | - | null | ❌ | ❌ | Maximum days access token remains valid |

**Relationships**:
- `userId` → `users_private.userId`
- `requisitionId` → `requisitions_dev.requisitionId`

---

### 4. bank_accounts_dev

**Purpose**: Development table for storing individual bank account details.

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this account |
| accountId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the bank account |
| institutionId | string | ✓ | 255 | null | ❌ | ❌ | Bank/institution identifier |
| institutionName | string | ❌ | 255 | null | ❌ | ❌ | Human-readable name of the institution |
| iban | string | ❌ | 50 | null | ❌ | ❌ | International Bank Account Number |
| accountName | string | ❌ | 255 | null | ❌ | ❌ | Display name for the account |
| currency | string | ✓ | 3 | null | ❌ | ❌ | Account currency (ISO 3-letter code) |
| status | string | ✓ | 50 | null | ❌ | ❌ | Current status of the account |
| raw | string | ❌ | 10000 | null | ❌ | ❌ | Raw account data from bank API |

**Relationships**:
- `userId` → `users_private.userId`
- `institutionId` → `bank_connections_dev.institutionId`

---

### 5. balances_dev

**Purpose**: Development table for storing account balance information.

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this account |
| accountId | string | ✓ | 255 | null | ❌ | ❌ | Reference to the bank account |
| balanceAmount | string | ✓ | 50 | null | ❌ | ❌ | Balance amount as string for precision |
| currency | string | ✓ | 3 | null | ❌ | ❌ | Balance currency (ISO 3-letter code) |
| balanceType | string | ✓ | 50 | null | ❌ | ❌ | Type of balance (e.g., available, current) |
| referenceDate | string | ✓ | 10 | null | ❌ | ❌ | Date of balance reference (YYYY-MM-DD) |

**Relationships**:
- `userId` → `users_private.userId`
- `accountId` → `bank_accounts_dev.accountId`

---

### 6. transactions_dev

**Purpose**: Development table for storing bank transaction data.

| Column | Type | Required | Size | Default | Array | Encrypted | Description |
|--------|------|----------|------|---------|-------|-----------|-------------|
| userId | string | ✓ | 255 | null | ❌ | ❌ | Reference to user who owns this transaction |
| accountId | string | ✓ | 255 | null | ❌ | ❌ | Reference to the bank account |
| transactionId | string | ✓ | 255 | null | ❌ | ❌ | Unique identifier for the transaction |
| amount | string | ✓ | 50 | null | ❌ | ❌ | Transaction amount as string for precision |
| currency | string | ✓ | 3 | null | ❌ | ❌ | Transaction currency (ISO 3-letter code) |
| bookingDate | string | ❌ | 10 | null | ❌ | ❌ | Date transaction was booked (YYYY-MM-DD) |
| bookingDateTime | string | ❌ | 25 | null | ❌ | ❌ | Full datetime of booking |
| valueDate | string | ❌ | 10 | null | ❌ | ❌ | Value date of transaction (YYYY-MM-DD) |
| description | string | ❌ | 500 | null | ❌ | ❌ | Transaction description |
| counterparty | string | ❌ | 255 | null | ❌ | ❌ | Other party involved in transaction |
| raw | string | ❌ | 10000 | null | ❌ | ❌ | Raw transaction data from bank API |
| exclude | boolean | ❌ | - | false | ❌ | ❌ | Whether to exclude from calculations |
| category | string | ❌ | 255 | null | ❌ | ❌ | Transaction category for organization |

**Relationships**:
- `userId` → `users_private.userId`
- `accountId` → `bank_accounts_dev.accountId`

---

## Data Flow & Relationships

```
users_private (userId)
    ↓
requisitions_dev (userId, requisitionId)
    ↓
bank_connections_dev (userId, requisitionId, institutionId)
    ↓
bank_accounts_dev (userId, institutionId, accountId)
    ↓
├── balances_dev (userId, accountId)
└── transactions_dev (userId, accountId)
```

## Key Design Decisions

1. **Development Tables**: All `_dev` tables are used for development/testing environments
2. **String Types for Financial Data**: Amounts and balances use string types to avoid floating-point precision issues
3. **Flexible Raw Data Storage**: Large `raw` fields store complete API responses for debugging
4. **User-Centric Design**: All tables include `userId` for data isolation
5. **Currency Fields**: Consistent 3-character currency codes throughout
6. **Status Tracking**: Multiple tables include status fields for state management

## Notes

- All tables use Appwrite's built-in `$id`, `$createdAt`, and `$updatedAt` fields
- The `users_private` table has restrictive permissions (users only)
- Development tables appear to have more permissive permissions for testing
- Date fields in development tables use string format for flexibility
- Large text fields accommodate complete API responses for audit trails