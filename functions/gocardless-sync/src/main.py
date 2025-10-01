"""Appwrite function entrypoint for GoCardless sync."""

import os
import time
from datetime import datetime

from appwrite.exception import AppwriteException

from .appwrite import (
    create_databases_client,
    document_exists,
    get_active_accounts,
    get_last_booking_date,
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
    context.log("🚀 Starting GoCardless sync...")

    try:
        databases = create_databases_client()
        gocardless = GoCardlessClient(
            os.environ["GOCARDLESS_SECRET_ID"], os.environ["GOCARDLESS_SECRET_KEY"]
        )

        database_id = os.environ["APPWRITE_DATABASE_ID"]
        transactions_collection = os.environ["APPWRITE_TRANSACTIONS_COLLECTION_ID"]
        bank_accounts_collection = os.environ["APPWRITE_BANK_ACCOUNTS_COLLECTION_ID"]
        balances_collection = os.environ["APPWRITE_BALANCES_COLLECTION_ID"]

        accounts = get_active_accounts(databases, database_id, bank_accounts_collection)
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
                last_date = get_last_booking_date(
                    databases, database_id, transactions_collection, user_id, account_id
                )
                context.log(f"📅 Last transaction date: {last_date}" if last_date else "📅 No previous transactions")

                transactions = _fetch_transactions(gocardless, account_id, last_date)
                context.log(f"📊 Found {len(transactions)} transactions")

                for tx in transactions[:50]:
                    doc_id = generate_doc_id(
                        tx.get("transactionId") or tx.get("internalTransactionId"),
                        account_id,
                        tx.get("bookingDate"),
                    )

                    if document_exists(databases, database_id, transactions_collection, doc_id):
                        continue

                    payload = format_transaction_payload(
                        tx,
                        user_id,
                        account_id,
                        doc_id,
                        databases,
                        database_id,
                        transactions_collection,
                    )

                    databases.create_document(database_id, transactions_collection, doc_id, payload)
                    total_transactions += 1
                    context.log(f"✅ Stored transaction: {doc_id}")

                balances = _fetch_balances(gocardless, account_id)

                for balance in balances:
                    balance_doc_id, payload = format_balance_payload(balance, user_id, account_id)

                    if document_exists(databases, database_id, balances_collection, balance_doc_id):
                        continue

                    databases.create_document(database_id, balances_collection, balance_doc_id, payload)
                    total_balances += 1
                    context.log(f"✅ Stored balance: {balance_doc_id}")

                if index < len(accounts) - 1:
                    time.sleep(1)

            except Exception as error:  # pylint: disable=broad-except
                context.log(f"❌ Error processing account {account_id}: {error}")

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

    except AppwriteException as error:
        context.error(f"💥 Appwrite error: {error}")
        return context.res.json({"success": False, "error": str(error)})
    except Exception as error:  # pylint: disable=broad-except
        context.error(f"💥 Sync failed: {error}")
        return context.res.json({"success": False, "error": str(error)})
