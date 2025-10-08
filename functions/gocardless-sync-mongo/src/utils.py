import json
import re
import time
from datetime import datetime
import openai

from .mongodb import fetch_previous_categories, get_encrypted_mongo_client, get_client_encryption_instance
from .explicit_encryption import (
    get_data_key_id,
    encrypt_queryable,
    encrypt_random,
    encrypt_transaction_fields,
    encrypt_balance_fields
)


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
    user_id: str,
) -> str:
    text = f"{description} {counterparty} {amount}".lower()

    previous_categories = fetch_previous_categories(user_id)
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
):
    """Format and encrypt transaction payload using explicit encryption."""
    transaction_amount = transaction.get("transactionAmount", {})
    amount = transaction_amount.get("amount", "0") if isinstance(transaction_amount, dict) else "0"
    description = (
        transaction.get("remittanceInformationUnstructured")
        or transaction.get("additionalInformation")
        or ""
    )
    counterparty = transaction.get("creditorName") or transaction.get("debtorName") or ""

    # CRITICAL: Categorize on plaintext BEFORE encryption
    category = categorize_transaction(description, counterparty, amount, user_id)
    
    # Get encryption clients
    mongo_client = get_encrypted_mongo_client()
    client_encryption = get_client_encryption_instance()
    data_key_id = get_data_key_id(client_encryption, mongo_client)
    
    # Use explicit encryption helper
    encrypted_payload = encrypt_transaction_fields(
        user_id,
        account_id,
        transaction,
        category,
        client_encryption,
        data_key_id
    )
    
    # Add timestamps
    encrypted_payload["createdAt"] = datetime.now().isoformat()
    encrypted_payload["updatedAt"] = datetime.now().isoformat()
    
    return encrypted_payload


def format_balance_payload(balance, user_id, account_id):
    """Format and encrypt balance payload using explicit encryption."""
    balance_type = balance.get("balanceType", "expected")
    reference_date = balance.get("referenceDate", datetime.now().strftime("%Y-%m-%d"))

    # Use a simpler doc_id based on account_id and balance_type only
    doc_id = f"{account_id}_{balance_type}"[:36]
    
    # Get encryption clients
    mongo_client = get_encrypted_mongo_client()
    client_encryption = get_client_encryption_instance()
    data_key_id = get_data_key_id(client_encryption, mongo_client)
    
    # Use explicit encryption helper
    encrypted_payload = encrypt_balance_fields(
        user_id,
        account_id,
        balance,
        client_encryption,
        data_key_id
    )
    
    # Add timestamps
    encrypted_payload["createdAt"] = datetime.now().isoformat()
    encrypted_payload["updatedAt"] = datetime.now().isoformat()
    
    return doc_id, encrypted_payload



