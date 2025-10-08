# ⚡ GoCardless Sync to MongoDB Function

Automated sync function that fetches transactions and balances from GoCardless and stores them in MongoDB with Queryable Encryption (QE).

## 🧰 Usage

This function is designed to run on a schedule (e.g., every hour) to sync financial data from GoCardless to MongoDB.

### Triggered Execution

The function will:
1. Fetch all active bank accounts from MongoDB
2. For each account, retrieve transactions and balances from GoCardless
3. Store new transactions and update balances in MongoDB with encryption
4. Skip duplicate transactions automatically
5. Return a summary of synced data

**Response**

Sample `200` Response:

```json
{
  "success": true,
  "transactionsSynced": 42,
  "balancesSynced": 8,
  "accountsProcessed": 4
}
```

## ⚙️ Configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Runtime           | Python (3.9)                      |
| Entrypoint        | `src/main.py`                     |
| Build Commands    | `pip install -r requirements.txt` |
| Permissions       | `any`                             |
| Timeout (Seconds) | 300                               |

## 🔒 Environment Variables

Required environment variables for MongoDB and GoCardless integration:

### MongoDB Configuration
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name (default: `finance_dev`)
- `MONGODB_KEY_VAULT_NS` - Key vault namespace (default: `encryption.__keyVault`)

### GCP KMS Configuration (for Queryable Encryption)
- `GCP_EMAIL` - GCP service account email
- `GCP_PRIVATE_KEY` - GCP service account private key
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_LOCATION` - GCP location (e.g., `global`)
- `GCP_KEY_RING` - GCP KMS key ring name
- `GCP_KEY_NAME` - GCP KMS key name

### GoCardless Configuration
- `GOCARDLESS_SECRET_ID` - GoCardless API secret ID
- `GOCARDLESS_SECRET_KEY` - GoCardless API secret key

### Optional Configuration
- `SHARED_LIB_PATH` - Path to MongoDB cryptSharedLib (if needed)
- `OPENAI_API_KEY` - OpenAI API key (for transaction categorization)

## 🔐 Data Encryption

This function writes data to MongoDB collections configured with Queryable Encryption (QE). Encryption is handled at the **server-side** by MongoDB based on collection schemas.

### Encrypted Fields (server-side)
- Transaction IDs, amounts, currencies
- Descriptions and counterparty information
- Account IBANs and names
- Balance amounts
- Raw transaction data

### Plaintext Fields (for indexing/querying)
- User IDs
- Account IDs
- Booking dates
- Categories
- Balance types

**Note:** The function attempts to enable client-side auto-encryption if `pymongocrypt` is available, but falls back to server-side encryption if the library is not present. Server-side encryption is sufficient for queryable encryption collections.

## 📊 Collections Used

- `bank_accounts_dev` - Active bank accounts to sync
- `transactions_dev` - Transaction records
- `balances_dev` - Account balance snapshots

## 🚀 Deployment

This function requires `libmongocrypt` to be installed system-wide for MongoDB Queryable Encryption support.

### Deploy to Appwrite

The function uses a custom `setup.sh` script that automatically installs `libmongocrypt-dev` during deployment:

1. **Deploy the function**:
   ```bash
   cd appwrite
   appwrite deploy function
   # Select: gocardless-sync-mongo
   ```

2. **Configure environment variables** in Appwrite Console (see section below)

3. **Set up scheduled execution** (recommended: hourly)

4. **Monitor logs** for sync status

### How It Works

The `setup.sh` script (configured in `appwrite.config.json` as the build command):
- Installs `libmongocrypt-dev` from [MongoDB's official repository](https://www.mongodb.com/docs/manual/core/csfle/reference/libmongocrypt/#linux-installation)
- Installs all Python dependencies from `requirements.txt`

```bash
# The setup.sh script runs:
apt-get update
apt-get install -y curl gpg
curl -s --location https://pgp.mongodb.com/libmongocrypt.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/libmongocrypt.gpg
echo "deb https://libmongocrypt.s3.amazonaws.com/apt/debian bookworm/libmongocrypt/1.16 main" | tee /etc/apt/sources.list.d/libmongocrypt.list
apt-get update
apt-get install -y libmongocrypt-dev
pip install -r requirements.txt
```

### Local Development

For local testing with the custom Dockerfile:

```bash
docker build -t gocardless-sync-mongo .
docker run -p 3000:3000 --env-file .env gocardless-sync-mongo
```

## 📝 Notes

- Maximum 50 transactions per account per sync (to prevent timeouts)
- Transactions are automatically categorized using AI
- Duplicate transactions are detected and skipped
- Balances are updated (not duplicated) for each account

