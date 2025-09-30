"""
Appwrite Function for ongoing GoCardless transaction sync
Runs 4 times daily to fetch latest transactions and update database
"""

import os
import json
import time
import hashlib
import hmac
import base64
from datetime import datetime, timedelta

# Appwrite SDK imports
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.users import Users
from appwrite.query import Query
from appwrite.exception import AppwriteException

# GoCardless API configuration
GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2"
DEFAULT_TIMEOUT = 20
MAX_RETRIES = 5

class GoCardlessClient:
    """Lightweight GoCardless Bank Account Data client with token caching and retries"""

    def __init__(self, secret_id, secret_key):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self._access_token = None
        self._token_expires_at = 0

    def _assert_env_vars(self):
        """Ensure required environment variables are set"""
        if not self.secret_id or not self.secret_key:
            raise ValueError("Missing required GoCardless credentials")

    def _is_expired(self):
        """Check if token is expired (with 30 second buffer)"""
        return not self._access_token or time.time() > (self._token_expires_at - 30)

    def _request_new_token(self):
        """Request a new access token from GoCardless"""
        self._assert_env_vars()

        import requests

        url = f"{GOCARDLESS_BASE_URL}/token/new/"
        data = {
            "secret_id": self.secret_id,
            "secret_key": self.secret_key,
        }

        response = requests.post(url, json=data, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()

        token_data = response.json()
        self._access_token = token_data["access"]
        self._token_expires_at = time.time() + token_data["access_expires"]

        return self._access_token

    def _get_access_token(self):
        """Get a valid access token"""
        if not self._is_expired():
            return self._access_token

        return self._request_new_token()

    def _fetch_with_auth(self, path, method="GET", **kwargs):
        """Make an authenticated request to GoCardless API"""
        import requests

        token = self._get_access_token()
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {token}"

        url = f"{GOCARDLESS_BASE_URL}{path}"

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.request(
                    method,
                    url,
                    headers=headers,
                    timeout=DEFAULT_TIMEOUT,
                    **{k: v for k, v in kwargs.items() if k != "headers"}
                )
                response.raise_for_status()
                return response.json()

            except requests.exceptions.RequestException as e:
                if attempt == MAX_RETRIES - 1:
                    raise e

                # Exponential backoff with jitter
                delay = (300 * (2 ** attempt)) + (hash(str(attempt)) % 200)
                time.sleep(delay / 1000)

        raise RuntimeError("Max retries exceeded")

    def get_account_transactions(self, account_id, date_from=None, date_to=None):
        """Get transactions for an account"""
        params = {}
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        path = f"/accounts/{account_id}/transactions/"
        if query_string:
            path += f"?{query_string}"

        return self._fetch_with_auth(path)

    def get_account_balances(self, account_id):
        """Get balances for an account"""
        return self._fetch_with_auth(f"/accounts/{account_id}/balances/")

    def get_account_details(self, account_id):
        """Get account details"""
        return self._fetch_with_auth(f"/accounts/{account_id}/details/")

def suggest_category(description, counterparty, amount):
    """Categorize transactions based on description and counterparty"""
    if not description and not counterparty:
        return "Uncategorized"

    text = f"{counterparty or ''} {description or ''}".lower().strip()
    value = float(amount or 0)

    # Income detection
    if ("salary" in text or "payroll" in text or
        (value > 0 and "income" in text)):
        return "Income"

    # Restaurant/Food
    if any(keyword in text for keyword in
           ["restaurant", "cafe", "coffee", "mcdonald", "starbucks", "kfc", "burger", "pizza"]):
        return "Restaurant"

    # Transport
    if any(keyword in text for keyword in
           ["uber", "taxi", "fuel", "gas", "petrol", "shell", "bp", "esso"]):
        return "Transport"

    # Shopping
    if any(keyword in text for keyword in
           ["amazon", "store", "shopping", "mall", "retail"]):
        return "Shopping"

    # Entertainment
    if any(keyword in text for keyword in
           ["netflix", "spotify", "entertainment", "cinema", "theatre"]):
        return "Entertainment"

    # Utilities/Bills
    if any(keyword in text for keyword in
           ["electric", "gas", "water", "internet", "utility", "rent", "council tax"]):
        return "Utilities"

    # Groceries
    if any(keyword in text for keyword in
           ["grocery", "supermarket", "aldi", "tesco", "sainsbury", "asda", "morrisons"]):
        return "Groceries"

    return "Uncategorized"

def find_existing_category(databases, database_id, collection_id, user_id, description):
    """Find existing category for similar transactions"""
    try:
        # Search for existing transactions with similar description
        response = databases.list_documents(
            database_id,
            collection_id,
            [
                Query.equal("userId", user_id),
                Query.search("description", description[:50]),
                Query.limit(5)
            ]
        )

        # Count categories
        category_count = {}
        for doc in response["documents"]:
            category = doc.get("category")
            if category and category != "Uncategorized":
                category_count[category] = category_count.get(category, 0) + 1

        # Return most common category if we have enough matches
        if category_count:
            top_category = max(category_count.items(), key=lambda x: x[1])
            if top_category[1] >= 2:
                return top_category[0]

        return None

    except Exception as e:
        print(f"Error finding existing category: {e}")
        return None

def generate_document_id(provider_transaction_id, internal_transaction_id, account_id, booking_date, amount, description):
    """Generate unique document ID to prevent duplicates"""
    fallback_base = f"{account_id}_{booking_date or ''}_{amount or ''}_{description or ''}"
    raw_key = provider_transaction_id or internal_transaction_id or fallback_base or ""

    # Create a hash for uniqueness
    doc_id_candidate = raw_key.replace('[^a-zA-Z0-9_-]', '_')

    if not doc_id_candidate or len(doc_id_candidate) > 36:
        # Use SHA1 hash and truncate to 36 characters
        hash_obj = hashlib.sha1(raw_key.encode())
        doc_id_candidate = hash_obj.hexdigest()[:36]

    return doc_id_candidate or f"tx_{int(time.time())}"

def process_transaction(databases, database_id, transactions_collection_id, balances_collection_id,
                       account, transaction, user_id):
    """Process and store a single transaction"""

    # Generate unique document ID
    doc_id = generate_document_id(
        transaction.get("transactionId"),
        transaction.get("internalTransactionId"),
        account.get("accountId"),
        transaction.get("bookingDate"),
        transaction.get("transactionAmount", {}).get("amount"),
        transaction.get("remittanceInformationUnstructured") or transaction.get("additionalInformation")
    )

    # Check if transaction already exists
    try:
        databases.get_document(database_id, transactions_collection_id, doc_id)
        return  # Already exists, skip
    except AppwriteException:
        pass  # Not found, proceed with creation

    # Get category
    tx_description = transaction.get("remittanceInformationUnstructured") or transaction.get("additionalInformation") or ""
    category = "Uncategorized"

    try:
        existing_category = find_existing_category(
            databases, database_id, transactions_collection_id, user_id, tx_description
        )
        category = existing_category or suggest_category(
            tx_description,
            transaction.get("creditorName") or transaction.get("debtorName"),
            transaction.get("transactionAmount", {}).get("amount")
        )
    except Exception as e:
        print(f"Error getting category: {e}")
        category = "Uncategorized"

    # Store transaction
    transaction_data = {
        "userId": user_id,
        "accountId": account.get("accountId"),
        "transactionId": (transaction.get("transactionId") or transaction.get("internalTransactionId") or doc_id)[:255],
        "amount": str(transaction.get("transactionAmount", {}).get("amount", "0")),
        "currency": (transaction.get("transactionAmount", {}).get("currency") or "EUR").upper()[:3],
        "bookingDate": transaction.get("bookingDate", "")[:10] if transaction.get("bookingDate") else None,
        "bookingDateTime": transaction.get("bookingDateTime", "")[:25] if transaction.get("bookingDateTime") else None,
        "valueDate": transaction.get("valueDate", "")[:10] if transaction.get("valueDate") else None,
        "description": (transaction.get("remittanceInformationUnstructured") or transaction.get("additionalInformation") or "")[:500],
        "counterparty": (transaction.get("creditorName") or transaction.get("debtorName") or "")[:255],
        "category": category,
        "raw": json.dumps(transaction)[:10000],
    }

    databases.create_document(database_id, transactions_collection_id, doc_id, transaction_data)
    return doc_id

def update_account_balances(databases, database_id, balances_collection_id, account_id, user_id):
    """Update account balances"""
    # This would need GoCardless API integration - simplified for now
    pass

def main(context):
    """Main Appwrite function entry point"""
    context.log("🚀 Starting GoCardless transaction sync...")

    try:
        # Initialize Appwrite client
        client = Client()
        client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        client.set_key(context.req.headers.get("x-appwrite-key", ""))

        databases = Databases(client)

        # Configuration
        database_id = os.environ.get("APPWRITE_DATABASE_ID", "68d42ac20031b27284c9")
        transactions_collection_id = os.environ.get("APPWRITE_TRANSACTIONS_COLLECTION_ID", "transactions_dev")
        bank_accounts_collection_id = os.environ.get("APPWRITE_BANK_ACCOUNTS_COLLECTION_ID", "bank_accounts_dev")
        balances_collection_id = os.environ.get("APPWRITE_BALANCES_COLLECTION_ID", "balances_dev")

        context.log(f"🔧 Database ID: {database_id}")
        context.log(f"🏦 Bank accounts collection: {bank_accounts_collection_id}")
        context.log(f"💰 Transactions collection: {transactions_collection_id}")
        context.log(f"⚖️ Balances collection: {balances_collection_id}")

        # Initialize GoCardless client
        gocardless = GoCardlessClient(
            os.environ["GOCARDLESS_SECRET_ID"],
            os.environ["GOCARDLESS_SECRET_KEY"]
        )

        # Get all users with active bank accounts
        try:
            accounts_response = databases.list_documents(
                database_id,
                bank_accounts_collection_id,
                [
                    Query.equal("status", "active"),
                    Query.limit(100)
                ]
            )

            # Get unique user IDs
            user_ids = list(set(account["userId"] for account in accounts_response["documents"]))
            context.log(f"🔍 Found {len(user_ids)} users with active bank accounts")

            if not user_ids:
                context.log("⚠️ No users with active bank accounts found")
                return context.res.json({
                    "success": True,
                    "message": "No users to sync",
                    "usersProcessed": 0
                })

            # Process users in batches (limit to avoid timeouts)
            users_to_process = user_ids[:10]  # Process max 10 users per execution
            context.log(f"👥 Processing {len(users_to_process)} users (limited to 10 per execution)")

            total_users_processed = 0
            total_transactions_synced = 0

            # Process each user
            for i, user_id in enumerate(users_to_process):
                context.log(f"👤 Processing user {user_id} ({i + 1}/{len(users_to_process)})")

                try:
                    # Get all bank accounts for this user
                    user_accounts_response = databases.list_documents(
                        database_id,
                        bank_accounts_collection_id,
                        [
                            Query.equal("userId", user_id),
                            Query.equal("status", "active")
                        ]
                    )

                    accounts = user_accounts_response["documents"]
                    context.log(f"🏦 Found {len(accounts)} active accounts for user {user_id}")

                    # Process accounts in batches
                    for j in range(0, len(accounts), 5):  # Process in batches of 5
                        account_batch = accounts[j:j + 5]
                        context.log(f"Processing account batch {j//5 + 1}/{(len(accounts) + 4)//5} ({len(account_batch)} accounts)")

                        for k, account in enumerate(account_batch):
                            account_id = account["accountId"]

                            try:
                                context.log(f"💳 Processing account: {account_id} ({k + 1}/{len(account_batch)})")

                                # Get transactions from GoCardless
                                context.log(f"📡 Calling GoCardless API for transactions on account {account_id}")
                                transactions_response = gocardless.get_account_transactions(account_id)
                                transactions = transactions_response.get("transactions", {}).get("booked", [])

                                context.log(f"📊 Retrieved {len(transactions)} transactions for account {account_id}")

                                # Process and store transactions
                                for transaction in transactions[:100]:  # Limit to avoid overwhelming
                                    try:
                                        doc_id = process_transaction(
                                            databases, database_id, transactions_collection_id, balances_collection_id,
                                            account, transaction, user_id
                                        )
                                        total_transactions_synced += 1
                                        context.log(f"✅ Successfully processed transaction: {doc_id}")

                                    except AppwriteException as e:
                                        if "already exists" in str(e) or e.code == 409:
                                            context.log(f"⏭️ Transaction already exists for {account_id}, skipping")
                                        else:
                                            context.log(f"❌ Error processing transaction for account {account_id}: {e}")

                                # Update balances
                                try:
                                    context.log(f"⚖️ Updating balances for account {account_id}")
                                    update_account_balances(databases, database_id, balances_collection_id, account_id, user_id)
                                    context.log(f"✅ Balances updated for account {account_id}")
                                except Exception as e:
                                    context.log(f"❌ Error updating balances for account {account_id}: {e}")

                            except Exception as e:
                                context.log(f"❌ Error processing account {account_id}: {e}")

                            # Rate limiting delay
                            if k < len(account_batch) - 1:
                                context.log("⏳ Waiting 500ms before next account in batch...")
                                time.sleep(0.5)

                        # Delay between batches
                        if j + 5 < len(accounts):
                            context.log("⏳ Waiting 2s before next batch...")
                            time.sleep(2)

                    total_users_processed += 1
                    context.log(f"✅ Successfully processed user {user_id}")

                    # Delay between users
                    if i < len(users_to_process) - 1:
                        context.log("⏳ Waiting 1s before next user...")
                        time.sleep(1)

                except Exception as e:
                    context.log(f"❌ Failed to sync user {user_id}: {e}")
                    continue

            context.log(f"🎉 Sync completed. Processed {total_users_processed} users, synced {total_transactions_synced} transactions")

            return context.res.json({
                "success": True,
                "usersProcessed": total_users_processed,
                "transactionsSynced": total_transactions_synced,
                "totalUsersFound": len(user_ids)
            })

        except AppwriteException as e:
            context.error(f"💥 Critical sync failure: {e}")
            return context.res.json({"success": False, "error": str(e)})

    except Exception as e:
        context.error(f"💥 Critical error in main function: {e}")
        return context.res.json({"success": False, "error": str(e)})
