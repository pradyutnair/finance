import json
import re
import time
from datetime import datetime
import openai

from .mongodb import fetch_previous_categories
from .explicit_encryption import encrypt_queryable, encrypt_random


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


def format_transaction_payload(transaction, user_id, account_id, doc_id):
    """Format and encrypt transaction payload using application-level encryption."""
    transaction_amount = transaction.get("transactionAmount", {})
    amount = transaction_amount.get("amount", "0") if isinstance(transaction_amount, dict) else "0"
    description = (
        transaction.get("remittanceInformationUnstructured")
        or transaction.get("additionalInformation")
        or ""
    )
    counterparty = transaction.get("creditorName") or transaction.get("debtorName") or ""
    provider_tx_id = transaction.get("transactionId") or transaction.get("internalTransactionId") or ""

    # Categorize on plaintext BEFORE encryption
    category = categorize_transaction(description, counterparty, amount, user_id)
    
    # Build encrypted payload
    currency = transaction_amount.get("currency") if isinstance(transaction_amount, dict) else "EUR"
    
    payload = {
        # Plaintext fields (queryable)
        "userId": user_id,
        "category": category,
        "exclude": False,
        "bookingDate": transaction.get("bookingDate", "")[:10] if transaction.get("bookingDate") else None,
        
        # Encrypted queryable fields (deterministic hash)
        "accountId": encrypt_queryable(account_id),
        "transactionId": encrypt_queryable(provider_tx_id),
        
        # Encrypted sensitive fields (Fernet encryption)
        "amount": encrypt_random(amount),
        "currency": encrypt_random(str(currency).upper()[:3]),
        "valueDate": encrypt_random(
            transaction.get("valueDate", "")[:10] if transaction.get("valueDate") else None
        ),
        "description": encrypt_random(description[:500] if description else None),
        "counterparty": encrypt_random(counterparty[:255] if counterparty else None),
        "raw": encrypt_random(str(transaction)[:10000]),
        
        # Timestamps
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Filter out None values
    return {k: v for k, v in payload.items() if v is not None}


def format_balance_payload(balance, user_id, account_id):
    """Format and encrypt balance payload using application-level encryption."""
    balance_type = balance.get("balanceType", "expected")
    reference_date = balance.get("referenceDate", datetime.now().strftime("%Y-%m-%d"))
    balance_amount = balance.get("balanceAmount", {})
    amount = balance_amount.get("amount", "0") if isinstance(balance_amount, dict) else "0"
    currency = balance_amount.get("currency", "EUR") if isinstance(balance_amount, dict) else "EUR"

    doc_id = f"{account_id}_{balance_type}"[:36]
    
    payload = {
        # Plaintext fields (queryable)
        "userId": user_id,
        "balanceType": balance_type,
        "referenceDate": reference_date,
        
        # Encrypted queryable field (deterministic hash)
        "accountId": encrypt_queryable(account_id),
        
        # Encrypted sensitive fields (Fernet encryption)
        "balanceAmount": encrypt_random(str(amount)),
        "currency": encrypt_random(str(currency).upper()[:3]),
        
        # Timestamps
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Filter out None values
    return doc_id, {k: v for k, v in payload.items() if v is not None}



