"""
Simplified GoCardless Sync Function
Fetches transactions and balances for all active bank accounts
"""

import os
import json
import time
import hashlib
import re
from datetime import datetime
import openai
# Appwrite SDK imports
from appwrite.client import Client
from appwrite.services.databases import Databases
#from appwrite.query import Query
from appwrite.exception import AppwriteException

############################################################# GoCardless
# GoCardless API configuration
GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2"
DEFAULT_TIMEOUT = 20
MAX_RETRIES = 3


class GoCardlessClient:
    """Simple GoCardless client with token caching"""

    def __init__(self, secret_id, secret_key):
        self.secret_id = secret_id
        self.secret_key = secret_key
        self._access_token = None
        self._token_expires_at = 0

    def _get_access_token(self):
        """Get valid access token"""
        if self._access_token and time.time() < (self._token_expires_at - 30):
            return self._access_token

        import requests

        url = f"{GOCARDLESS_BASE_URL}/token/new/"
        data = {"secret_id": self.secret_id, "secret_key": self.secret_key}

        response = requests.post(url, json=data, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()

        token_data = response.json()
        self._access_token = token_data["access"]
        self._token_expires_at = time.time() + token_data["access_expires"]
        return self._access_token

    def _request(self, path, params=None):
        """Make authenticated request"""
        import requests

        token = self._get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{GOCARDLESS_BASE_URL}{path}"

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.get(
                    url, headers=headers, params=params, timeout=DEFAULT_TIMEOUT
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    raise e
                time.sleep(1)

    def get_transactions(self, account_id, date_from=None):
        """Get transactions for account"""
        params = {"date_from": date_from} if date_from else {}
        return self._request(f"/accounts/{account_id}/transactions/", params)

    def get_balances(self, account_id):
        """Get balances for account"""
        return self._request(f"/accounts/{account_id}/balances/")


############################################################# Helper functions
def generate_doc_id(transaction_id, account_id, booking_date):
    """Generate unique document ID"""
    raw_key = transaction_id or f"{account_id}_{booking_date}_{int(time.time())}"
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(raw_key))[:36]
    return clean_id or f"tx_{int(time.time())}"


def get_last_booking_date(databases, database_id, collection_id, user_id, account_id):
    """Get last transaction date for incremental sync"""
    try:
        resp = databases.list_documents(
            database_id,
            collection_id,
            queries=[
                {"method": "equal", "column": "userId", "values": [user_id]},
                {"method": "equal", "column": "accountId", "values": [account_id]},
                {"method": "orderDesc", "column": "bookingDate"},
                {"method": "limit", "values": [1]},
            ],
        )
        docs = resp.get("documents", []) if isinstance(resp, dict) else resp['documents']
        if docs:
            return docs[0].get("bookingDate") or docs[0].get("valueDate") or None
        return None
    except Exception as e:
        print(f"Error fetching last booking date: {e}")
        return None


############################################################# Categorization
def load_categories():
    """Return the list of available categories"""
    return [
        "Groceries",
        "Restaurant",
        "Education",
        "Transport",
        "Travel",
        "Shopping",
        "Utilities",
        "Entertainment",
        "Health",
        "Income",
        "Miscellaneous",
        "Uncategorized",
        "Bank Transfer",
    ]



def load_previous_categories(
    databases, database_id: str, collection_id: str, user_id: str
) -> list[str]:
    """Load previous categories from the Appwrite database if it exists"""
    try:
        resp = databases.list_documents(
            database_id,
            collection_id,
            queries=[
                {"method": "equal", "column": "userId", "values": [user_id]},
                {"method": "limit", "values": [100]},
            ],
        )
        documents = resp.get("documents", [])
        if documents:
            return [doc.get("category", "") for doc in documents if doc.get("category")]
        return []
    except Exception as e:
        print(f"❌ Error loading previous categories: {e}")
        return []


def lazy_categorize(description, counterparty, amount):
    """Simple transaction categorization"""
    text = f"{counterparty or ''} {description or ''}".lower()

    if any(word in text for word in ["restaurant", "cafe", "coffee", "mcdonald", "starbucks"]):
        return "Restaurant"
    elif any(word in text for word in ["uber", "taxi", "fuel", "gas", "petrol"]):
        return "Transport"
    elif any(word in text for word in ["amazon", "store", "shopping", "mall"]):
        return "Shopping"
    elif any(word in text for word in ["netflix", "spotify", "entertainment"]):
        return "Entertainment"
    elif any(word in text for word in ["electric", "gas", "water", "internet", "rent"]):
        return "Utilities"
    elif any(word in text for word in ["grocery", "supermarket", "aldi", "tesco"]):
        return "Groceries"
    elif float(amount or 0) > 0 and any(word in text for word in ["salary", "payroll", "income"]):
        return "Income"
    else:
        return "Uncategorized"

def categorize_transaction(
    description: str,
    counterparty: str,
    amount: str,
    databases,
    database_id: str,
    collection_id: str,
    user_id: str,
) -> str:
    """
    Categorize a transaction using OpenAI gpt-5-nano
    """
    # Get the text to categorize
    text = f"{description} {counterparty} {amount}".lower()
    
    # Check if the transaction has already been categorized
    previous_categories = load_previous_categories(
        databases, database_id, collection_id, user_id
    )
    if text in previous_categories:
        print(f"🔍 Transaction already categorized: {text}")
        return text

    # Get the categories
    categories = load_categories()

    # Do a simple heuristic categorization
    category = lazy_categorize(description, counterparty, amount)
    if category != "Uncategorized":
        return category

    # Categorize using OpenAI as last resort
    try:
        response = openai.chat.completions.create(
            model="gpt-5-nano",
            messages=[
                {
                    "role": "system",
                    "content": f"You are a strict classifier. Reply with exactly one category name from this list and nothing else: {categories}.",
                },
                {
                    "role": "user",
                    "content": f"Transaction\nCounterparty: {counterparty}\nDescription: {description}\nAmount: {amount}\nReturn one of: {categories}",
                },
            ]
        )
        category = response.choices[0].message.content.strip()
        print(f"Categorized transaction: {text} as {category} via OpenAI")
        return category if category in categories else "Uncategorized"

    except Exception as e:
        print(f"❌ Error categorizing transaction: {e}")
        return "Uncategorized"


############################################################# Main
def main(context):
    """Main function"""
    context.log("🚀 Starting GoCardless sync...")

    try:
        # Initialize clients
        client = Client()
        client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        client.set_key(os.environ["APPWRITE_API_KEY"])

        databases = Databases(client)
        gocardless = GoCardlessClient(
            os.environ["GOCARDLESS_SECRET_ID"], os.environ["GOCARDLESS_SECRET_KEY"]
        )

        # Configuration
        database_id = os.environ["APPWRITE_DATABASE_ID"]
        transactions_collection = os.environ["APPWRITE_TRANSACTIONS_COLLECTION_ID"]
        bank_accounts_collection = os.environ["APPWRITE_BANK_ACCOUNTS_COLLECTION_ID"]
        balances_collection = os.environ["APPWRITE_BALANCES_COLLECTION_ID"]

        # Get all active bank accounts
        accounts_response = databases.list_documents(
            database_id,
            bank_accounts_collection,
            queries=[
                {"method": "equal", "column": "status", "values": ["active"]},
                {"method": "limit", "values": [50]},
            ],
        )
        accounts = accounts_response.get("documents", []) if isinstance(accounts_response, dict) else accounts_response['documents']
        context.log(f"🏦 Found {len(accounts)} active accounts")

        if not accounts:
            return context.res.json({"success": True, "message": "No accounts to sync"})

        total_transactions = 0
        total_balances = 0

        # Process each account
        for i, account in enumerate(accounts):
            account_id = account["accountId"]
            user_id = account["userId"]
            context.log(f"💳 Processing account {i+1}/{len(accounts)}: {account_id}")

            try:
                # Get last transaction date
                last_date = get_last_booking_date(
                    databases, database_id, transactions_collection, user_id, account_id
                )
                if last_date:
                    context.log(f"📅 Last transaction: {last_date}")
                else:
                    context.log("📅 No previous transactions found")

                # Fetch transactions
                try:
                    tx_response = gocardless.get_transactions(account_id, last_date)
                    if not isinstance(tx_response, dict):
                        context.log(f"❌ Invalid transaction response type: {type(tx_response)}")
                        continue

                    transactions_data = tx_response.get("transactions", {})
                    if not isinstance(transactions_data, dict):
                        context.log(f"❌ Invalid transactions data type: {type(transactions_data)}")
                        continue

                    transactions = transactions_data.get("booked", [])
                    if not isinstance(transactions, list):
                        context.log(f"❌ Invalid transactions list type: {type(transactions)}")
                        continue

                    context.log(f"📊 Found {len(transactions)} transactions")
                except Exception as e:
                    context.log(f"❌ Error fetching transactions: {e}")
                    continue

                # Store transactions
                for tx in transactions[:50]:
                    try:
                        if not isinstance(tx, dict):
                            context.log(f"❌ Invalid transaction data type: {type(tx)}, value: {tx}")
                            continue

                        tx_id = tx.get("transactionId") or tx.get("internalTransactionId")
                        doc_id = generate_doc_id(tx_id, account_id, tx.get("bookingDate"))

                        # Skip if exists
                        try:
                            databases.get_document(database_id, transactions_collection, doc_id)
                            continue
                        except:
                            pass

                        transaction_amount = tx.get("transactionAmount", {})
                        if not isinstance(transaction_amount, dict):
                            transaction_amount = {}

                        amount = transaction_amount.get("amount", "0")
                        description = (
                            tx.get("remittanceInformationUnstructured")
                            or tx.get("additionalInformation")
                            or ""
                        )
                        counterparty = tx.get("creditorName") or tx.get("debtorName") or ""

                        tx_data = {
                            "userId": user_id,
                            "accountId": account_id,
                            "transactionId": str(tx_id)[:255] if tx_id else doc_id,
                            "amount": str(amount),
                            "currency": (transaction_amount.get("currency") or "EUR")[:3],
                            "bookingDate": (tx.get("bookingDate", "")[:10] if tx.get("bookingDate") else None),
                            "valueDate": (tx.get("valueDate", "")[:10] if tx.get("valueDate") else None),
                            "description": description[:500],
                            "counterparty": counterparty[:255],
                            "category": categorize_transaction(
                                description,
                                counterparty,
                                amount,
                                databases,
                                database_id,
                                transactions_collection,
                                user_id,
                            ),
                            "raw": json.dumps(tx)[:10000],
                        }

                        databases.create_document(database_id, transactions_collection, doc_id, tx_data)
                        total_transactions += 1
                        context.log(f"✅ Stored transaction: {doc_id}")

                    except Exception as e:
                        context.log(f"❌ Error storing transaction: {e}")
                        context.log(f"❌ Transaction data: {tx}")

                # Fetch and store balances
                try:
                    balance_response = gocardless.get_balances(account_id)
                    if not isinstance(balance_response, dict):
                        context.log(f"❌ Invalid balance response type: {type(balance_response)}")
                        balances = []
                    else:
                        balances = balance_response.get("balances", [])

                    if not isinstance(balances, list):
                        context.log(f"❌ Invalid balances list type: {type(balances)}")
                        balances = []

                    for balance in balances:
                        if not isinstance(balance, dict):
                            context.log(f"❌ Invalid balance data type: {type(balance)}, value: {balance}")
                            continue

                        balance_type = balance.get("balanceType", "closingBooked")
                        reference_date = balance.get("referenceDate", datetime.now().strftime("%Y-%m-%d"))
                        balance_amount = balance.get("balanceAmount", {})
                        if not isinstance(balance_amount, dict):
                            balance_amount = {}

                        amount = balance_amount.get("amount", "0")
                        balance_doc_id = f"{account_id}_{balance_type}_{reference_date}"[:36]

                        try:
                            databases.get_document(database_id, balances_collection, balance_doc_id)
                            continue
                        except:
                            pass

                        balance_data = {
                            "userId": user_id,
                            "accountId": account_id,
                            "balanceAmount": str(amount),
                            "currency": (balance_amount.get("currency") or "EUR")[:3],
                            "balanceType": balance_type,
                            "referenceDate": reference_date,
                        }

                        databases.create_document(database_id, balances_collection, balance_doc_id, balance_data)
                        total_balances += 1
                        context.log(f"✅ Stored balance: {balance_doc_id}")

                except Exception as e:
                    context.log(f"❌ Error storing balances: {e}")

                # Rate limiting
                if i < len(accounts) - 1:
                    time.sleep(1)

            except Exception as e:
                context.log(f"❌ Error processing account {account_id}: {e}")

        context.log(f"🎉 Sync completed: {total_transactions} transactions, {total_balances} balances")
        return context.res.json(
            {
                "success": True,
                "transactionsSynced": total_transactions,
                "balancesSynced": total_balances,
                "accountsProcessed": len(accounts),
            }
        )

    except Exception as e:
        context.error(f"💥 Sync failed: {e}")
        return context.res.json({"success": False, "error": str(e)})
