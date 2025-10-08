"""Appwrite function entrypoint for GoCardless sync to MongoDB."""

import os
import time

from .mongodb import (
    get_db,
    get_last_booking_date,
    document_exists,
    find_balance_document,
    create_transaction,
    create_balance,
    update_balance,
    get_user_bank_accounts,
)
from .utils import (
    format_balance_payload,
    format_transaction_payload,
    generate_doc_id,
)
from .gocardless import GoCardlessClient
from .appwrite_users import list_user_ids


def _fetch_transactions(client: GoCardlessClient, account_id: str, last_date: str | None):
    response = client.get_transactions(account_id, last_date)
    return response.get("transactions", {}).get("booked", []) if isinstance(response, dict) else []


def _fetch_balances(client: GoCardlessClient, account_id: str):
    response = client.get_balances(account_id)
    return response.get("balances", []) if isinstance(response, dict) else []


def main(context):
    context.log("🚀 Starting GoCardless sync to MongoDB...")

    try:
        # Validate environment variables
        required_env_vars = ["GOCARDLESS_SECRET_ID", "GOCARDLESS_SECRET_KEY", "MONGODB_URI"]
        missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
        if missing_vars:
            error_msg = f"Missing environment variables: {', '.join(missing_vars)}"
            context.error(error_msg)
            return context.res.json({"success": False, "error": error_msg}, 400)

        context.log("🔧 Initializing GoCardless client...")
        gocardless = GoCardlessClient(
            os.environ["GOCARDLESS_SECRET_ID"], 
            os.environ["GOCARDLESS_SECRET_KEY"]
        )

        context.log("🔍 Connecting to MongoDB...")
        db = get_db()
        db.command('ping')
        context.log("✅ MongoDB connected")

        # Fetch users from Appwrite
        context.log("🔍 Fetching users from Appwrite...")
        user_ids = list_user_ids(context)
        context.log(f"👥 Found {len(user_ids)} users")
        
        if not user_ids:
            return context.res.json({"success": True, "message": "No users to sync"})

        total_transactions = 0
        total_balances = 0
        accounts_processed = 0
        failed_accounts = []

        for user_index, user_id in enumerate(user_ids):
            context.log(f"👤 Processing user {user_index + 1}/{len(user_ids)}: {user_id}")

            # Get user's bank accounts from MongoDB
            accounts = get_user_bank_accounts(user_id)
            context.log(f"🏦 Found {len(accounts)} accounts")
            
            if not accounts:
                continue

            for index, account in enumerate(accounts):
                try:
                    account_id = account.get("accountId")
                    if not account_id:
                        context.log("⚠️ Account missing accountId, skipping")
                        continue
                    
                    accounts_processed += 1
                    context.log(f"💳 Processing account {accounts_processed}: {account_id}")

                    # Get last booking date
                    last_date = get_last_booking_date(user_id, account_id)
                    if last_date:
                        context.log(f"📅 Last booking date: {last_date}")

                    # Fetch transactions from GoCardless
                    transactions = _fetch_transactions(gocardless, account_id, last_date)
                    context.log(f"📊 Found {len(transactions)} transactions")

                    for tx in transactions[:50]:
                        doc_id = generate_doc_id(
                            tx.get("transactionId") or tx.get("internalTransactionId"),
                            account_id,
                            tx.get("bookingDate"),
                        )

                        if document_exists("transactions_dev", doc_id):
                            continue

                        payload = format_transaction_payload(tx, user_id, account_id, doc_id)
                        create_transaction(doc_id, payload)
                        total_transactions += 1

                    # Fetch balances from GoCardless
                    balances = _fetch_balances(gocardless, account_id)

                    for balance in balances:
                        balance_type = balance.get("balanceType", "expected")
                        existing_doc_id = find_balance_document(user_id, account_id, balance_type)
                        
                        _, payload = format_balance_payload(balance, user_id, account_id)
                        
                        if existing_doc_id:
                            update_balance(existing_doc_id, {
                                "balanceAmount": payload["balanceAmount"],
                                "referenceDate": payload["referenceDate"],
                                "currency": payload["currency"]
                            })
                        else:
                            balance_doc_id, _ = format_balance_payload(balance, user_id, account_id)
                            create_balance(balance_doc_id, payload)

                        total_balances += 1

                    if index < len(accounts) - 1:
                        time.sleep(1)

                except Exception as error:
                    error_msg = f"{type(error).__name__}: {str(error)}"
                    context.log(f"❌ Error: {error_msg}")
                    failed_accounts.append({
                        "userId": user_id, 
                        "accountId": account.get('accountId'), 
                        "error": error_msg
                    })

        context.log(f"🎉 Sync completed: {total_transactions} transactions, {total_balances} balances")
        
        return context.res.json({
            "success": len(failed_accounts) == 0,
            "transactionsSynced": total_transactions,
            "balancesSynced": total_balances,
            "accountsProcessed": accounts_processed,
            "accountsFailed": len(failed_accounts),
            "failures": failed_accounts if failed_accounts else None
        })

    except Exception as error:
        context.error(f"💥 Sync failed: {error}")
        return context.res.json({"success": False, "error": str(error)})

