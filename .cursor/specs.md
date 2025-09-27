# Spec Sheet: Finance Dashboard App (100% Appwrite: Auth, DB, Functions)  
_Target: B2C personal finance dashboard integrated with GoCardless Bank Account Data (AIS). All authentication and data live in Appwrite. Add Google sign-in via Appwrite OAuth._

---

## 0) High-Level Architecture

- **Frontend**: Web (Next.js/React) or your preferred stack, using **Appwrite Web SDK** for Auth (email/password + Google OAuth) and Databases access.  
- **Backend**: **Appwrite Functions** (Node.js runtime) for all privileged logic and to call **GoCardless Bank Account Data** APIs. Functions expose HTTP routes and scheduled jobs (cron).  [oai_citation:0‡appwrite.io](https://appwrite.io/docs/products/functions?utm_source=chatgpt.com)  
- **Data**: **Appwrite Databases** with row-level permissions (Row Security) so users can only access their data.  [oai_citation:1‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)  
- **Secrets**: GoCardless keys + App settings stored as **Function Environment Variables** (marked secret) and never exposed to the client.  [oai_citation:2‡appwrite.io](https://appwrite.io/docs/products/functions?utm_source=chatgpt.com)  
- **Scheduling**: Use **Function cron schedules** to periodically refresh tokens and sync new transactions.  [oai_citation:3‡appwrite.io](https://appwrite.io/docs/products/functions/functions?utm_source=chatgpt.com)

---

## 1) Authentication (Appwrite) — Email/Password + Google OAuth

### 1.1 Email/Password (baseline)
- Use Appwrite **Account** API for signup, login, logout in the client. Sessions are cookie-based; the SDK manages them.  [oai_citation:4‡appwrite.io](https://appwrite.io/docs/references/1.6.x/client-web/databases?utm_source=chatgpt.com)

### 1.2 Google Sign-In (OAuth2 via Appwrite)
**Goal:** Users can “Continue with Google” to create/login to an Appwrite account (identity is attached to the same user).  [oai_citation:5‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)

**Steps (Console):**
1. In **Appwrite Console → Auth → Settings → OAuth2 Providers**, click **Google**.  
2. In Google Cloud Console, create **OAuth 2.0 Client ID** (Web application). Add **Authorized redirect URI** that Appwrite shows for Google provider. Paste the **Client ID**/**Client Secret** into Appwrite. Save.  [oai_citation:6‡appwrite.io](https://appwrite.io/integrations/oauth-google?utm_source=chatgpt.com)

**Client Flow:**
- On the web, call `account.createOAuth2Token('google', successRedirect, failureRedirect)` which redirects to Google, then back to Appwrite to create the identity + session; finally redirects back to your app. (Exact method name may vary by SDK version; follow the OAuth2 reference.)  [oai_citation:7‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)

**Notes:**
- Users can have multiple identities; Appwrite merges under one account. Session management is identical to email/password auth through the SDK.  [oai_citation:8‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)

---

## 2) GoCardless Bank Account Data Integration (AIS)

### 2.1 What you’ll use
- **Institutions**: Show searchable list for users to pick their bank.  
- **Requisitions**: Create a link/consent flow; receive user back on your redirect.  
- **Accounts / Balances / Transactions**: Pull data after consent.  
- **Statuses & Errors**: Track requisition + account states for UI.  
All endpoints require **Authorization token** (Bearer).  [oai_citation:9‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/overview?utm_source=chatgpt.com)

### 2.2 Consent Flow (end-to-end)
1. **List institutions** (optional: by country); render picker modal.  [oai_citation:10‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/quick-start-guide?utm_source=chatgpt.com)  
2. **Create requisition** with `institution_id` and your **redirect URI** (the route handled by your Function). Store the returned requisition ID + link.  [oai_citation:11‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/quick-start-guide?utm_source=chatgpt.com)  
3. **Redirect user** to the requisition link for PSD2 consent/login.  
4. **Handle callback** on your Function’s HTTP endpoint:
   - Validate query params/state.
   - Exchange/confirm authorization → persist connection, then **fetch accounts**.
5. **Initial data pull**: For each account, fetch **balances** and **transactions** (up to the provider’s available history) and write to Appwrite DB.  [oai_citation:12‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/transactions?utm_source=chatgpt.com)

### 2.3 Ongoing Sync
- **Cron job** to refresh tokens before expiry and fetch incremental transactions (dedupe by provider transaction id).  
- Respect **API rate limits**; use retry/backoff. (Some providers limit daily calls; design sync windows appropriately.)  [oai_citation:13‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/overview?utm_source=chatgpt.com)

---

## 3) Appwrite Databases — Collections, Attributes, Indexes, Permissions

> Create a single **Database** (e.g., `finance`) with the following **Collections**. Enable **Row Security** on all user data collections, and set owner-only permissions at document creation time.  [oai_citation:14‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)

### 3.1 `users_private`
Minimal per-user profile/settings. (Appwrite Account is source of truth for auth.)
- **Attributes**
  - `userId` (string; required) — equals `Account.$id`
  - `role` (string; default `"user"`)
  - `createdAt` (datetime; default now)
  - `updatedAt` (datetime; default now)
- **Indexes**
  - `idx_users_private_userId` on `userId` (unique)
- **Permissions**
  - **Document**: `read`, `update` = userId; `create` by the user on first run (via Function), `delete` by owner.
- **Notes**
  - Use this for preferences (currency, locale, etc.).

### 3.2 `requisitions`
Track GoCardless requisitions/links.
- **Attributes**
  - `userId` (string; required)
  - `requisitionId` (string; required, unique)
  - `institutionId` (string; required)
  - `institutionName` (string)
  - `redirectUri` (string; required)
  - `status` (string; e.g., `"LINK_CREATED"|"UNDERGOING_AUTHENTICATION"|"EXPIRED"|"LINKED"|"REVOKED"`)
  - `reference` (string; optional)
  - `createdAt` / `updatedAt` (datetime)
- **Indexes**
  - `idx_reqs_user` on `userId`
  - `uniq_requisitionId` on `requisitionId` (unique)
- **Permissions**
  - Owner-only read/write.

### 3.3 `bank_connections`
One per consented institution per user; stores tokens + status.
- **Attributes**
  - `userId` (string; required)
  - `institutionId` (string; required)
  - `institutionName` (string)
  - `status` (string; `"active"|"expired"|"revoked"|"disconnected"`)
  - `accessToken` (string; **ENCRYPTED client-side in Function before write**)
  - `refreshToken` (string; **ENCRYPTED**)
  - `accessExpiresAt` (datetime)
  - `refreshExpiresAt` (datetime)
  - `lastSyncedAt` (datetime)
  - `logoUrl` (string; optional)
  - `transactionTotalDays` (number; optional)
  - `maxAccessValidforDays` (number; optional)
  - `createdAt` / `updatedAt` (datetime)
- **Indexes**
  - `idx_conn_user` on `userId`
  - `idx_conn_status` on `status`
- **Permissions**
  - Owner-only read/write.

### 3.4 `bank_accounts`
Accounts returned by GoCardless for a connection.
- **Attributes**
  - `userId` (string; required)
  - `connectionId` (string; required) — document ID of `bank_connections`
  - `accountId` (string; required) — provider account id
  - `iban` (string; optional)
  - `currency` (string; required; 3-letter ISO)
  - `accountName` (string; optional)
  - `type` (string; optional)
  - `raw` (json; optional) — full provider payload for debugging
  - `createdAt` / `updatedAt` (datetime)
- **Indexes**
  - `idx_accts_user` on `userId`
  - `uniq_acct_per_conn` on (`connectionId`, `accountId`) unique
- **Permissions**
  - Owner-only read/write.

### 3.5 `balances`
Balance snapshots (optionally keep a time series).
- **Attributes**
  - `userId` (string; required)
  - `connectionId` (string; required)
  - `accountId` (string; required)
  - `balanceAmount` (string or decimal)
  - `currency` (string; 3-letter)
  - `balanceType` (string; e.g., `"interimBooked"|"closingBooked"` — map to provider)  [oai_citation:15‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/balance?utm_source=chatgpt.com)
  - `referenceDate` (date)
  - `lastChangeDateTime` (datetime; optional)
  - `createdAt` (datetime; default now)
- **Indexes**
  - `idx_balances_user_acct_date` on (`userId`, `accountId`, `referenceDate`)
- **Permissions**
  - Owner-only read/write.

### 3.6 `transactions`
Transaction feed (large volume; index carefully).
- **Attributes**
  - `userId` (string; required)
  - `connectionId` (string; required)
  - `accountId` (string; required)
  - `transactionId` (string; provider id; required)
  - `amount` (string or decimal; required)
  - `currency` (string; required)
  - `bookingDate` (date; optional)
  - `bookingDateTime` (datetime; optional)
  - `valueDate` (date; optional)
  - `description` (string; optional)
  - `counterparty` (string; optional; map from creditor/debtor names)  
  - `category` (string; optional; your classifier)
  - `raw` (json; optional)
  - `createdAt` (datetime; default now)
- **Indexes**
  - `uniq_txn_per_account` on (`accountId`, `transactionId`) unique
  - `idx_txn_user_date` on (`userId`, `bookingDate`)
  - `idx_txn_user_account` on (`userId`, `accountId`)
- **Permissions**
  - Owner-only read/write.
- **Mapping**: Align fields with GoCardless **Transactions** output (amount, currency, booking/value dates, descriptions, codes).  [oai_citation:16‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/transactions?utm_source=chatgpt.com)

### 3.7 `audit_logs`
Operational logs (optionally keep admin-only read).
- **Attributes**
  - `userId` (string; optional)
  - `action` (string; e.g., `BANK_CONNECT_START`, `TOKEN_REFRESH_OK`, `SYNC_FAIL`)
  - `details` (json)
  - `timestamp` (datetime; default now)
- **Indexes**
  - `idx_logs_user_time` on (`userId`, `timestamp`)
- **Permissions**
  - Write by Functions. Read by owner; or admin-only if you prefer.

---

## 4) Appwrite Functions — Endpoints, Schedules, Env Vars

> Use **Node.js** runtime. Each function has its own **env vars**, **permissions**, and **HTTP URL**. Use cron for scheduled sync.  [oai_citation:17‡appwrite.io](https://appwrite.io/docs/references/cloud/server-nodejs/functions?utm_source=chatgpt.com)

### 4.1 Environment Variables (set in each Function)
- **GoCardless**
  - `GC_BAD_BASE_URL` (e.g., `https://bankaccountdata.gocardless.com/api`)  
  - `GC_BAD_SECRET` or `GC_BAD_ACCESS_TOKEN` (authorization token for BAD)  
  - `GC_REDIRECT_URI` (your requisition redirect URL handled by callback function)
- **Crypto**
  - `ENCRYPTION_KEY` (for encrypting tokens before DB write)
- **App**
  - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY` (used server-to-server in Functions SDK)
- **Misc**
  - Any feature flags, logging levels, etc.

> Configure in Console → Function → Settings → Environment Variables (mark secrets as secret).  [oai_citation:18‡appwrite.io](https://appwrite.io/docs/products/functions?utm_source=chatgpt.com)

### 4.2 HTTP Functions (public API surface)

| Function (HTTP)             | Method | Purpose                                                                                                   |
|-----------------------------|--------|-----------------------------------------------------------------------------------------------------------|
| `bank-connect`              | POST   | Start the consent flow: takes `institutionId`; creates requisition; returns `requisitionLink`.           |
| `bank-callback`             | GET    | Redirect URI target: verifies requisition, finalizes access, creates/updates `bank_connections`, triggers initial fetch. |
| `accounts-list`             | GET    | Returns accounts for the user (`connectionId` optional to filter).                                       |
| `balances-get`              | GET    | Returns latest balance(s) for a given `accountId`.                                                        |
| `transactions-get`          | GET    | Paginated transactions for `accountId` with `from`/`to` filters.                                          |
| `bank-refresh`              | POST   | Force a token refresh for a `connectionId`; updates DB state.                                             |

**Implementation details (per function):**

- **Auth enforcement**:  
  - Verify Appwrite session with the **JWT or cookies** depending on your integration (use Appwrite Node SDK to get current user or require a userId header signed by your frontend after verifying session).  
- **DB writes**:  
  - All writes go through the **Databases** API using a service API key scoped to the DB. Set document permissions to owner-only (`userId`).  [oai_citation:19‡appwrite.io](https://appwrite.io/docs/references/1.6.x/client-web/databases?utm_source=chatgpt.com)
- **bank-connect**:  
  - Validate `institutionId`.  
  - Call GoCardless **requisitions** create endpoint with `redirect`. Persist in `requisitions`. Return `requisitionLink`.  [oai_citation:20‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/quick-start-guide?utm_source=chatgpt.com)
- **bank-callback**:  
  - Read query params from redirect.  
  - Confirm requisition status via **statuses**/requisition retrieval.  
  - Create or update `bank_connections` with encrypted `accessToken`/`refreshToken` + expiries. Then call **accounts** list and seed `bank_accounts`, `balances`, `transactions`.  [oai_citation:21‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/statuses?utm_source=chatgpt.com)
- **transactions-get**:  
  - Prefer DB reads; fetch from provider only if cache-miss or forced refresh. Support `page`, `limit`, `from`, `to`.  
- **bank-refresh**:  
  - Check expiry; call token refresh if supported; update DB.

### 4.3 Scheduled Functions (cron)
- **sync-connections** (every 4–6 hours):  
  - For each `bank_connections` with `status="active"`, if `accessExpiresAt` near expiry → refresh.  
  - For each `bank_accounts`, pull incremental **transactions** since last fetch; dedupe and insert; update `lastSyncedAt`.  
  - Backoff on 429/5xx errors; log to `audit_logs`.  
  - Example schedules: `0 */4 * * *` (every 4 hours) or stagger per user to spread load.  [oai_citation:22‡appwrite.io](https://appwrite.io/docs/products/functions/functions?utm_source=chatgpt.com)

---

## 5) Frontend Integration (using Appwrite SDK)

### 5.1 Session & Identity
- **Sign Up/In**: email/password OR **Google** button that calls Appwrite OAuth2. On return, you have an Appwrite session.  [oai_citation:23‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)

### 5.2 Bank Linking UX
- **Connect Bank** button → open **Institution Picker** (client fetches institutions through your `bank-connect` pre-step or directly from a Function if you prefer not to expose institution API).  
- On submit: POST to `bank-connect` with `institutionId`. Receive `requisitionLink`; `window.location.href = link`.  
- After bank auth: user returns to your `bank-callback` route → show “Syncing…” → poll `bank_connections`/`bank_accounts` → then dashboard.

### 5.3 Dashboard Views
- **Summary Cards** (this month): Income, Expenses, Net, % Saved.  
- **Line Chart**: Income vs Expenses over time.  
- **Recent Transactions**: Paginated table, negative in red, positive in green.  
- **Category Breakdown**: Donut or bar.  
- **Controls**: Date range; “Sync now”.

### 5.4 Data Access Pattern
- Read from Appwrite `bank_accounts`, `balances`, `transactions` (owner-only docs).  
- For “Sync now”, call `bank-refresh` (or a `sync-now` end-point that triggers a fetch for a specific account).

---

## 6) Security & Compliance

- **Row Security** ON for all user data; set doc-level permissions to the owner’s `userId`.  [oai_citation:24‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)  
- **Never expose tokens** to the client; keep in Functions only, **encrypted** at rest.  
- **HTTPS** only; restrict origins in Appwrite Project settings.  
- **Data deletion**: Provide UI to delete account → Function deletes all docs for `userId` (requisitions, connections, accounts, balances, transactions, logs).  
- **Error states**: Map provider **statuses** (expired/revoked) to UI prompts to re-connect.  [oai_citation:25‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/statuses?utm_source=chatgpt.com)

---

## 7) Extremely Detailed Build Plan (Step-by-Step)

### 7.1 Appwrite Project Setup
1. Create **Project** in Appwrite Console.  
2. **Auth**:
   - Enable **Email/Password**.  
   - Enable **Google** provider; paste Google Client ID/Secret; copy Appwrite’s redirect URI into Google Cloud. Test login.  [oai_citation:26‡appwrite.io](https://appwrite.io/integrations/oauth-google?utm_source=chatgpt.com)
3. **Database**:
   - Create database `finance`.  
   - Create collections in order with attributes, indexes, and Row Security enabled:
     - `users_private`, `requisitions`, `bank_connections`, `bank_accounts`, `balances`, `transactions`, `audit_logs`. (See §3 for exact fields/indexes/permissions.)  [oai_citation:27‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)
4. **API Keys**:
   - Create **Server API Key** with Databases + Functions scopes for Functions to use SDK server-to-server.

### 7.2 Functions — Create & Configure
Create these Functions (Node.js runtime), each with:
- **Entrypoint**: `src/index.ts` (or `index.js`).  
- **Events/Triggers**: HTTP for routes; cron for schedulers.  
- **Env Vars** per §4.1 (mark secrets).  
- **Permissions**: Allow any to invoke HTTP routes if they verify session inside; or restrict to authenticated only.

**Functions list:**
1. `bank-connect` (HTTP: POST)  
2. `bank-callback` (HTTP: GET)  
3. `accounts-list` (HTTP: GET)  
4. `balances-get` (HTTP: GET)  
5. `transactions-get` (HTTP: GET)  
6. `bank-refresh` (HTTP: POST)  
7. `sync-connections` (CRON)

**Implementation notes:**
- Add a small internal library in your Functions repo:  
  - `appwriteClient.ts`: creates server Appwrite client with `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`.  
  - `crypto.ts`: AES-GCM encrypt/decrypt helpers using `ENCRYPTION_KEY`.  
  - `gocardless.ts`: thin client for BAD endpoints (institutions, requisitions, accounts, balances, transactions). Include retry/backoff and 429 handling.  
- **bank-connect**: Validate `institutionId`, POST to BAD requisitions create with `redirect`, write document in `requisitions`, return link.  [oai_citation:28‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/quick-start-guide?utm_source=chatgpt.com)  
- **bank-callback**: Verify requisition status; if linked, store encrypted tokens + expiries in `bank_connections`; pull **accounts**, then initial **balances** + **transactions** write.  [oai_citation:29‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/statuses?utm_source=chatgpt.com)  
- **transactions-get**: Query `transactions` by `accountId` with pagination and optional `from`/`to`.  
- **bank-refresh**: If `accessExpiresAt` < threshold, call refresh; on success, update; else mark `status="revoked"` and log.  
- **sync-connections (cron)**: Iterate active connections; refresh if due; for each account fetch incremental transactions since last known record; insert new; update `lastSyncedAt`.

### 7.3 Frontend — Pages & Components
- **Auth pages**: Sign in / Sign up with `Continue with Google` + email/password. (Use Appwrite Web SDK.)  [oai_citation:30‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)  
- **Bank linking**:
  - `ConnectBankModal`: calls POST `/bank-connect` → redirects to requisition link.  
  - `PostCallback` page: shown after return from bank; calls `/accounts-list`; shows “Syncing…” until records present.  
- **Dashboard**:
  - `SummaryCards`, `LineChart`, `TransactionsTable`, `CategoryChart`.  
  - Filters: date range; account selector.  
  - `SyncNowButton`: calls `bank-refresh`.
- **Data layer**: Hooks around Appwrite SDK to read collections (with current user session).

---

## 8) Testing & Observability

- **Sandbox**: Use GoCardless sandbox/postman collection to simulate flows.  [oai_citation:31‡Postman](https://www.postman.com/gocardlessapi/gocardless-api/collection/28f4dal/gocardless?utm_source=chatgpt.com)  
- **Logs**: Log every function execution outcome. Persist structured events in `audit_logs`.  
- **Backfills**: For new users, run full 24-month pull (where available); for existing, only incremental.  
- **Error UX**: Map BAD statuses to actionable copy (reconnect, try later, etc.).  [oai_citation:32‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/statuses?utm_source=chatgpt.com)

---

## 9) Rate Limits & Sync Strategy

- Respect per-endpoint and per-bank rate limits; cap sync to a small number of runs/day per bank; stagger cron. (Some clients report ~4 syncs/day per bank is reasonable; confirm with your BAD contract.)  [oai_citation:33‡actualbudget.org](https://actualbudget.org/docs/advanced/bank-sync/gocardless/?utm_source=chatgpt.com)  
- Use exponential backoff on 429/5xx; capture retry-after headers if provided.

---

## 10) Data Mapping References

- **Transactions** fields: transaction id, amount, currency, booking/value dates, descriptions, bank codes, counterparty details.  [oai_citation:34‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/transactions?utm_source=chatgpt.com)  
- **Balances** fields: amount, currency, type (`interimBooked`, `closingBooked`), `referenceDate`, `lastChangeDateTime`.  [oai_citation:35‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/balance?utm_source=chatgpt.com)  
- **Accounts/Details**: IBAN, name, type (if available) → map to `bank_accounts`.  [oai_citation:36‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/account-details?utm_source=chatgpt.com)

---

## 11) Exactly What to Create in Appwrite Console

1. **Project**: `finance-b2c`  
2. **Auth**:
   - Enable **Email/Password**.  
   - Enable **Google** provider; paste Google credentials; copy Appwrite redirect into Google console. Test login.  [oai_citation:37‡appwrite.io](https://appwrite.io/integrations/oauth-google?utm_source=chatgpt.com)
3. **Database**: `finance`
   - **Collections** (enable Row Security on each; set owner-only permissions at creation):
     - `users_private` (attrs: `userId`, `role`, `createdAt`, `updatedAt`; index: `userId` unique).  [oai_citation:38‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)
     - `requisitions` (attrs: §3.2; indexes: `userId`, `requisitionId` unique).  
     - `bank_connections` (attrs: §3.3; indexes: `userId`, `status`).  
     - `bank_accounts` (attrs: §3.4; indexes: `userId`, unique (`connectionId`,`accountId`)).  
     - `balances` (attrs: §3.5; index: (`userId`,`accountId`,`referenceDate`)).  
     - `transactions` (attrs: §3.6; indexes: unique (`accountId`,`transactionId`), (`userId`,`bookingDate`), (`userId`,`accountId`)).  
     - `audit_logs` (attrs: §3.7; index: (`userId`,`timestamp`)).  
4. **API Key**: `server_finance_key` with Databases + Functions scopes.  
5. **Functions** (Node.js):
   - `bank-connect` (HTTP) — env: `GC_BAD_BASE_URL`, `GC_BAD_ACCESS_TOKEN`, `GC_REDIRECT_URI`, `APPWRITE_*`, `ENCRYPTION_KEY`.  
   - `bank-callback` (HTTP) — same env.  
   - `accounts-list` (HTTP) — `APPWRITE_*`.  
   - `balances-get` (HTTP) — `APPWRITE_*`.  
   - `transactions-get` (HTTP) — `APPWRITE_*`.  
   - `bank-refresh` (HTTP) — `GC_BAD_*`, `APPWRITE_*`, `ENCRYPTION_KEY`.  
   - `sync-connections` (CRON: `0 */4 * * *`) — same env.  [oai_citation:39‡appwrite.io](https://appwrite.io/docs/products/functions/functions?utm_source=chatgpt.com)
6. **CORS / Platforms**: Add your web app origin to Appwrite **Platforms** and CORS settings.

---

## 12) Launch Checklist

- [ ] Google OAuth verified and working (identity merges with existing user).  [oai_citation:40‡appwrite.io](https://appwrite.io/docs/products/auth/oauth2?utm_source=chatgpt.com)  
- [ ] Requisition flow works end-to-end; callback persists connections and pulls initial data.  [oai_citation:41‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/quick-start-guide?utm_source=chatgpt.com)  
- [ ] Scheduled sync jobs successfully refresh tokens and fetch incremental transactions.  [oai_citation:42‡appwrite.io](https://appwrite.io/docs/products/functions/execute?utm_source=chatgpt.com)  
- [ ] Row Security enforced; no cross-user reads.  [oai_citation:43‡appwrite.io](https://appwrite.io/docs/products/databases/permissions?utm_source=chatgpt.com)  
- [ ] Error/status mapping surfaced in UI (expired/revoked).  [oai_citation:44‡developer.gocardless.com](https://developer.gocardless.com/bank-account-data/statuses?utm_source=chatgpt.com)  
- [ ] Rate limits respected; backoff + retries.  
- [ ] Data deletion endpoint (GDPR-friendly).

---