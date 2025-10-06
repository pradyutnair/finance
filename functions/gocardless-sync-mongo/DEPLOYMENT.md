# Deployment Guide: GoCardless Sync to MongoDB

## Prerequisites

1. Appwrite Cloud or self-hosted instance with Functions enabled
2. MongoDB Atlas or MongoDB instance with Queryable Encryption configured
3. GoCardless API credentials
4. GCP KMS setup (optional, for client-side encryption)

## Step 1: Create Function in Appwrite

```bash
# Using Appwrite CLI
appwrite functions create \
  --functionId gocardless-sync-mongo \
  --name "GoCardless Sync to MongoDB" \
  --runtime python-3.9 \
  --execute any \
  --entrypoint "src/main.py" \
  --timeout 300
```

Or create via Appwrite Console:
- Go to Functions → Create Function
- Name: `GoCardless Sync to MongoDB`
- Runtime: `Python 3.9`
- Entrypoint: `src/main.py`
- Execute permissions: `any` (or specific roles)
- Timeout: `300` seconds

## Step 2: Configure Environment Variables

Add the following environment variables to your function:

### Required
```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
GOCARDLESS_SECRET_ID=your_gocardless_secret_id
GOCARDLESS_SECRET_KEY=your_gocardless_secret_key
```

### Optional (for auto-encryption)
```bash
MONGODB_DB=finance_dev
MONGODB_KEY_VAULT_NS=encryption.__keyVault
GCP_EMAIL=your-service-account@project.iam.gserviceaccount.com
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=global
GCP_KEY_RING=your-key-ring
GCP_KEY_NAME=your-key-name
```

### Optional (AI categorization)
```bash
OPENAI_API_KEY=sk-...
```

## Step 3: Deploy Function Code

### Option A: Using Appwrite CLI

```bash
cd functions/gocardless-sync-mongo
appwrite functions createDeployment \
  --functionId gocardless-sync-mongo \
  --entrypoint "src/main.py" \
  --code . \
  --activate true
```

### Option B: Manual Upload

1. Zip the function directory:
   ```bash
   cd functions/gocardless-sync-mongo
   zip -r deployment.zip . -x "*.git*" -x "__pycache__/*"
   ```

2. Upload via Appwrite Console:
   - Go to Functions → gocardless-sync-mongo → Deployments
   - Upload `deployment.zip`
   - Set entrypoint: `src/main.py`
   - Activate deployment

## Step 4: Set Up Scheduled Execution (Recommended)

Configure the function to run automatically:

```bash
# Run every hour
appwrite functions createExecution \
  --functionId gocardless-sync-mongo \
  --async true
```

Or set up a cron trigger in Appwrite Console:
- Go to Functions → gocardless-sync-mongo → Settings
- Add Schedule: `0 * * * *` (hourly)

## Step 5: Test the Function

### Manual Execution

Via Appwrite CLI:
```bash
appwrite functions createExecution \
  --functionId gocardless-sync-mongo
```

Via Appwrite Console:
- Go to Functions → gocardless-sync-mongo
- Click "Execute Now"

### Expected Response

Success:
```json
{
  "success": true,
  "transactionsSynced": 42,
  "balancesSynced": 8,
  "accountsProcessed": 4,
  "accountsFailed": 0
}
```

Partial Success:
```json
{
  "success": false,
  "transactionsSynced": 30,
  "balancesSynced": 6,
  "accountsProcessed": 4,
  "accountsFailed": 1,
  "failures": [
    {
      "accountId": "account123",
      "error": "RequestException: timeout"
    }
  ]
}
```

## Troubleshooting

### Error: Missing mongocrypt library

**Solution:** This is expected. The function will fall back to server-side encryption which is sufficient for queryable encryption collections.

**Log message:**
```
⚠️ Failed to enable auto-encryption: ...
⚠️ Falling back to connection without auto-encryption
⚠️ Server-side encryption will still be applied based on collection schema
✅ MongoDB client initialized (server-side encryption only)
```

### Error: Failed to connect to MongoDB

**Check:**
1. `MONGODB_URI` is correct and accessible from Appwrite Functions
2. MongoDB Atlas allows connections from Appwrite IP addresses
3. Network settings and firewall rules

### Error: No accounts to sync

**Check:**
1. MongoDB has documents in `bank_accounts_dev` collection
2. Accounts have `status: "active"`
3. Collection has required fields: `accountId`, `userId`, `status`

### Error: GoCardless API errors

**Check:**
1. `GOCARDLESS_SECRET_ID` and `GOCARDLESS_SECRET_KEY` are correct
2. GoCardless account is active and has API access
3. Rate limits are not exceeded

## Monitoring

View logs in Appwrite Console:
- Functions → gocardless-sync-mongo → Executions
- Click on any execution to view detailed logs

Key log indicators:
- ✅ Success indicators
- ⚠️ Warnings (non-critical)
- ❌ Errors (per-account failures)
- 💥 Critical failures (entire function failed)

## Performance Tuning

- **Timeout:** Increase if processing many accounts (default: 300s)
- **Transaction limit:** Function processes max 50 transactions per account per run
- **Rate limiting:** 1-second delay between accounts to avoid API throttling
- **Schedule:** Run more frequently for real-time sync, less frequently to reduce costs

## Security Best Practices

1. ✅ Use Appwrite environment variables (never hardcode secrets)
2. ✅ Limit function execution permissions to specific roles
3. ✅ Monitor function logs for suspicious activity
4. ✅ Rotate API credentials regularly
5. ✅ Use encrypted MongoDB collections for sensitive data

