import json
import re
import time
from datetime import datetime
import openai

from .appwrite import fetch_previous_categories


def generate_doc_id(transaction_id, account_id, booking_date):
    raw_key = transaction_id or f"{account_id}_{booking_date or ''}_{int(time.time())}"
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(raw_key))[:36]
    return clean_id or f"tx_{int(time.time())}"


def lazy_categorize(description: str, counterparty: str, amount: str) -> str:
    text = f"{counterparty or ''} {description or ''}".lower()

    if any(word in text for word in ["restaurant", "cafe", "coffee", "mcdonald", "starbucks"]):
        return "Restaurants"
    if any(word in text for word in ["uber", "taxi", "fuel", "gas", "petrol"]):
        return "Transport"
    if any(word in text for word in ["amazon", "store", "shopping", "mall"]):
        return "Shopping"
    if any(word in text for word in ["netflix", "spotify", "entertainment"]):
        return "Entertainment"
    if any(word in text for word in ["electric", "gas", "water", "internet", "rent"]):
        return "Utilities"
    if any(word in text for word in ["grocery", "supermarket", "aldi", "tesco"]):
        return "Groceries"
    if float(amount or 0) > 0 and any(word in text for word in ["salary", "payroll", "income"]):
        return "Income"
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
    text = f"{description} {counterparty} {amount}".lower()

    previous_categories = fetch_previous_categories(databases, database_id, collection_id, user_id)
    if text in previous_categories:
        return text

    category = lazy_categorize(description, counterparty, amount)
    if category != "Uncategorized":
        return category

    categories = [
        "Groceries",
        "Restaurants",
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
            ],
        )
        category = response.choices[0].message.content.strip()
        return category if category in categories else "Uncategorized"
    except Exception:
        return "Uncategorized"


def format_transaction_payload(
    transaction,
    user_id,
    account_id,
    doc_id,
    databases,
    database_id,
    transactions_collection,
):
    transaction_amount = transaction.get("transactionAmount", {})
    amount = transaction_amount.get("amount", "0") if isinstance(transaction_amount, dict) else "0"
    description = (
        transaction.get("remittanceInformationUnstructured")
        or transaction.get("additionalInformation")
        or ""
    )
    counterparty = transaction.get("creditorName") or transaction.get("debtorName") or ""

    return {
        "userId": user_id,
        "accountId": account_id,
        "transactionId": str(transaction.get("transactionId") or transaction.get("internalTransactionId"))[:255]
        if (transaction.get("transactionId") or transaction.get("internalTransactionId"))
        else doc_id,
        "amount": str(amount),
        "currency": (transaction_amount.get("currency") if isinstance(transaction_amount, dict) else "EUR")[:3],
        "bookingDate": transaction.get("bookingDate", "")[:10] if transaction.get("bookingDate") else None,
        "valueDate": transaction.get("valueDate", "")[:10] if transaction.get("valueDate") else None,
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
        "raw": json.dumps(transaction)[:10000],
    }


def format_balance_payload(balance, user_id, account_id):
    balance_type = balance.get("balanceType", "expected")
    reference_date = balance.get("referenceDate", datetime.now().strftime("%Y-%m-%d"))
    balance_amount = balance.get("balanceAmount", {})
    amount = balance_amount.get("amount", "0") if isinstance(balance_amount, dict) else "0"

    # Use a simpler doc_id based on account_id and balance_type only
    doc_id = f"{account_id}_{balance_type}"[:36]
    payload = {
        "userId": user_id,
        "accountId": account_id,
        "balanceAmount": str(amount),
        "currency": (balance_amount.get("currency") if isinstance(balance_amount, dict) else "EUR")[:3],
        "balanceType": balance_type,
        "referenceDate": reference_date,
    }
    return doc_id, payload


