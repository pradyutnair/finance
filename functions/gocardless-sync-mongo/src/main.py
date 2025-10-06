"""Appwrite function entrypoint for GoCardless sync to MongoDB."""

import os
import time

from .mongodb import (
    get_active_accounts,
    get_last_booking_date,
    document_exists,
    find_balance_document,
    create_transaction,
    create_balance,
    update_balance,
)
from .utils import (
    format_balance_payload,
    format_transaction_payload,
    generate_doc_id,
)

from .gocardless import GoCardlessClient


def _fetch_transactions(client: GoCardlessClient, account_id: str, last_date: str | None):
    response = client.get_transactions(account_id, last_date)
    return response.get("transactions", {}).get("booked", []) if isinstance(response, dict) else []


def _fetch_balances(client: GoCardlessClient, account_id: str):
    response = client.get_balances(account_id)
    return response.get("balances", []) if isinstance(response, dict) else []


def main(context):
    context.log("🚀 Starting GoCardless sync to MongoDB...")

    try:
        context.log("🔧 Initializing GoCardless client...")
        gocardless = GoCardlessClient(
            os.environ["GOCARDLESS_SECRET_ID"], os.environ["GOCARDLESS_SECRET_KEY"]
        )
        context.log("✅ GoCardless client initialized")

        context.log("🔍 Fetching active bank accounts from MongoDB...")
        accounts = get_active_accounts()
        context.log(f"🏦 Found {len(accounts)} active accounts")

        if not accounts:
            return context.res.json({"success": True, "message": "No accounts to sync"})

        total_transactions = 0
        total_balances = 0

        for index, account in enumerate(accounts):
            account_id = account["accountId"]
            user_id = account["userId"]
            context.log(f"💳 Processing account {index + 1}/{len(accounts)}: {account_id}")

            try:
                context.log(f"🔍 Getting last booking date for account {account_id}...")
                last_date = get_last_booking_date(user_id, account_id)
                context.log(f"📅 Last transaction date: {last_date}" if last_date else "📅 No previous transactions")

                context.log(f"🔍 Fetching transactions for account {account_id}...")
                transactions = _fetch_transactions(gocardless, account_id, last_date)
                context.log(f"📊 Found {len(transactions)} transactions")

                for tx in transactions[:50]:
                    context.log(f"🔍 Processing transaction: {tx.get('transactionId', 'unknown')}")
                    doc_id = generate_doc_id(
                        tx.get("transactionId") or tx.get("internalTransactionId"),
                        account_id,
                        tx.get("bookingDate"),
                    )

                    context.log(f"🔍 Checking if document exists: {doc_id}")
                    if document_exists("transactions_dev", doc_id):
                        context.log(f"⏭️ Document {doc_id} already exists, skipping")
                        continue

                    context.log(f"🔍 Formatting transaction payload for {doc_id}...")
                    payload = format_transaction_payload(
                        tx,
                        user_id,
                        account_id,
                        doc_id,
                    )

                    context.log(f"🔍 Creating document {doc_id} in MongoDB...")
                    create_transaction(doc_id, payload)
                    total_transactions += 1
                    context.log(f"✅ Stored transaction: {doc_id}")

                context.log(f"🔍 Fetching balances for account {account_id}...")
                balances = _fetch_balances(gocardless, account_id)

                for balance in balances:
                    balance_type = balance.get("balanceType", "expected")
                    context.log(f"🔍 Processing balance: {balance_type}")
                    
                    # Find the exact document by userId, accountId, and balanceType
                    existing_doc_id = find_balance_document(user_id, account_id, balance_type)
                    
                    # Format the balance payload
                    _, payload = format_balance_payload(balance, user_id, account_id)
                    
                    # Update the balance document if it exists
                    if existing_doc_id:
                        update_balance(
                            existing_doc_id,
                            {
                                "balanceAmount": payload["balanceAmount"],
                                "referenceDate": payload["referenceDate"],
                                "currency": payload["currency"]
                            }
                        )
                        context.log(f"✅ Updated balance amount: {existing_doc_id}")
                    else:
                        # Create a new balance document if it doesn't exist
                        balance_doc_id, _ = format_balance_payload(balance, user_id, account_id)
                        create_balance(balance_doc_id, payload)
                        context.log(f"✅ Created balance: {balance_doc_id}")

                    total_balances += 1

                if index < len(accounts) - 1:
                    time.sleep(1)

            except Exception as error:  # pylint: disable=broad-except
                context.log(f"❌ Error processing account {account_id}: {error}")
                context.log(f"❌ Error type: {type(error).__name__}")
                context.log(f"❌ Error details: {str(error)}")

        context.log(
            f"🎉 Sync completed: {total_transactions} transactions, {total_balances} balances"
        )
        return context.res.json(
            {
                "success": True,
                "transactionsSynced": total_transactions,
                "balancesSynced": total_balances,
                "accountsProcessed": len(accounts),
            }
        )

    except Exception as error:  # pylint: disable=broad-except
        context.error(f"💥 Sync failed: {error}")
        context.error(f"💥 Error type: {type(error).__name__}")
        context.error(f"💥 Error details: {str(error)}")
        return context.res.json({"success": False, "error": str(error)})

