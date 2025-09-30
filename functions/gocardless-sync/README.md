# GoCardless Transaction Sync Function

This Appwrite Function synchronizes bank transaction data from GoCardless into your Appwrite database. It runs 4 times daily to fetch the latest transactions and update your database.

## Features

- **Automatic Sync**: Fetches transactions from all active GoCardless accounts
- **Deduplication**: Prevents duplicate transactions using unique IDs
- **Categorization**: Uses existing heuristic-based categorization from your codebase
- **Rate Limit Handling**: Implements exponential backoff for API rate limits
- **Error Handling**: Comprehensive error handling and logging

## Environment Variables

The following environment variables must be configured:

### Appwrite Configuration
- `APPWRITE_ENDPOINT`: Your Appwrite endpoint URL
- `APPWRITE_PROJECT_ID`: Your Appwrite project ID
- `APPWRITE_API_KEY`: API key with server permissions
- `APPWRITE_DATABASE_ID`: Database ID containing your collections
- `APPWRITE_TRANSACTIONS_COLLECTION_ID`: Transactions collection ID (default: `transactions_dev`)
- `APPWRITE_BANK_ACCOUNTS_COLLECTION_ID`: Bank accounts collection ID (default: `bank_accounts_dev`)
- `APPWRITE_BALANCES_COLLECTION_ID`: Balances collection ID (default: `balances_dev`)

### GoCardless Configuration
- `GOCARDLESS_SECRET_ID`: Your GoCardless API secret ID
- `GOCARDLESS_SECRET_KEY`: Your GoCardless API secret key

## Deployment

1. **Create the Function in Appwrite Console**:
   - Go to Functions → Add Function
   - Name: `gocardless-sync`
   - Runtime: Node.js 20.0
   - Entrypoint: `index.js`

2. **Deploy the Function**:
   ```bash
   # From the function directory
   appwrite functions create --function-id gocardless-sync --name "GoCardless Sync" --runtime node-20.0 --entrypoint index.js

   # Deploy the code
   appwrite functions deploy gocardless-sync
   ```

3. **Configure Environment Variables**:
   - In the Appwrite Console, go to the function settings
   - Add all required environment variables

4. **Set Up Cron Schedule**:
   - In the function settings, set the schedule to: `0 8,14,20,23 * * *`
   - This runs the function at 08:00, 14:00, 20:00, and 23:00 UTC daily

## Monitoring

- Check execution logs in the Appwrite Console
- Monitor for rate limit errors and adjust timing if needed
- Verify that transactions are being synced correctly

## Troubleshooting

- **Rate Limits**: If you hit GoCardless rate limits, the function will automatically retry with exponential backoff
- **Authentication Errors**: Check that your API keys are correct and have the required permissions
- **Database Errors**: Ensure your Appwrite collections exist and have the correct permissions

## Collection Schema

The function expects the following collections to exist:

- `bank_accounts_dev`: Stores connected bank account information
- `transactions_dev`: Stores transaction data
- `balances_dev`: Stores account balance data

Refer to your existing schema for exact field requirements.
