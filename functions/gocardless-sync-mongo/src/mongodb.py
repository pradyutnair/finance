"""MongoDB client for Serverless."""

import os
from pymongo import MongoClient

# Global client instance
_client = None


def get_mongo_db_name():
    return os.environ.get("MONGODB_DB", "finance_dev")


def get_mongo_client():
    """Get singleton MongoDB client."""
    global _client
    if _client:
        return _client

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI is not set")
    
    _client = MongoClient(uri)
    return _client


def get_db():
    """Get MongoDB database."""
    client = get_mongo_client()
    return client[get_mongo_db_name()]


def get_active_accounts():
    """Fetch all active bank accounts from MongoDB."""
    db = get_db()
    collection = db["bank_accounts_dev"]
    
    # First, check if collection exists and has documents
    total_count = collection.count_documents({})
    print(f"Total documents in bank_accounts_dev: {total_count}")
    
    if total_count == 0:
        print("⚠️ No documents found in bank_accounts_dev collection")
        return []
    
    # Query by plaintext userId field (status is encrypted, can't query directly)
    # With explicit encryption, we query on plaintext fields only
    accounts = list(collection.find({}).limit(50))
    print(f"Found {len(accounts)} accounts to process (out of {total_count} total)")
    
    # Filter for active status after decryption (done in-memory)
    active_accounts = [acc for acc in accounts if acc.get("status") == "active"]
    print(f"Active accounts after decryption: {len(active_accounts)}")
    
    return active_accounts if active_accounts else accounts


def get_user_requisitions(user_id: str):
    """Return requisitions for a given userId from requisitions_dev.
    Note: requisition fields are encrypted; only userId is plaintext.
    """
    db = get_db()
    collection = db["requisitions_dev"]
    return list(collection.find({"userId": user_id}))


def get_user_bank_accounts(user_id: str):
    """Return bank accounts for a given userId from bank_accounts_dev."""
    db = get_db()
    collection = db["bank_accounts_dev"]
    accounts = list(collection.find({"userId": user_id}))
    
    # Decrypt accountId field if encrypted
    from .explicit_encryption import decrypt_value
    for account in accounts:
        if account.get("accountId"):
            # Try to decrypt - if it fails, it's already plaintext
            try:
                decrypted = decrypt_value(account["accountId"])
                if decrypted:
                    account["accountId"] = decrypted
            except Exception:
                pass
    
    return accounts


def get_last_booking_date(user_id, account_id):
    """Get the most recent booking date for a user's account."""
    from .explicit_encryption import encrypt_queryable
    
    db = get_db()
    collection = db["transactions_dev"]
    
    try:
        # Query using encrypted accountId (deterministic hash)
        encrypted_account_id = encrypt_queryable(account_id)
        
        result = collection.find_one(
            {"userId": user_id, "accountId": encrypted_account_id},
            sort=[("bookingDate", -1)]
        )
        if result:
            return result.get("bookingDate") or result.get("valueDate")
        return None
    except Exception:
        return None


def document_exists(collection_name, doc_id):
    """Check if a document exists by its _id."""
    db = get_db()
    collection = db[collection_name]
    
    try:
        result = collection.find_one({"_id": doc_id})
        return result is not None
    except Exception:
        return False


def find_balance_document(user_id, account_id, balance_type):
    """Find a balance document by userId, accountId, and balanceType."""
    from .explicit_encryption import encrypt_queryable
    
    db = get_db()
    collection = db["balances_dev"]
    
    try:
        # Query using encrypted accountId (deterministic hash)
        encrypted_account_id = encrypt_queryable(account_id)
        
        result = collection.find_one({
            "userId": user_id,
            "accountId": encrypted_account_id,
            "balanceType": balance_type
        })
        return result["_id"] if result else None
    except Exception:
        return None


def fetch_previous_categories(user_id):
    """Fetch previously used categories for a user (for categorization hints)."""
    db = get_db()
    collection = db["transactions_dev"]
    
    try:
        result = collection.find_one({"userId": user_id})
        if result:
            return [result.get("category")]
        return []
    except Exception:
        return []


def create_transaction(doc_id, encrypted_payload):
    """Insert a new transaction document (with pre-encrypted fields)."""
    db = get_db()
    collection = db["transactions_dev"]
    
    encrypted_payload["_id"] = doc_id
    encrypted_payload["createdAt"] = encrypted_payload.get("createdAt") or ""
    encrypted_payload["updatedAt"] = encrypted_payload.get("updatedAt") or ""
    collection.insert_one(encrypted_payload)


def create_balance(doc_id, encrypted_payload):
    """Insert a new balance document (with pre-encrypted fields)."""
    db = get_db()
    collection = db["balances_dev"]
    
    encrypted_payload["_id"] = doc_id
    encrypted_payload["createdAt"] = encrypted_payload.get("createdAt") or ""
    encrypted_payload["updatedAt"] = encrypted_payload.get("updatedAt") or ""
    collection.insert_one(encrypted_payload)


def update_balance(doc_id, encrypted_payload):
    """Update an existing balance document (with pre-encrypted fields)."""
    db = get_db()
    collection = db["balances_dev"]
    
    encrypted_payload["updatedAt"] = encrypted_payload.get("updatedAt") or ""
    collection.update_one(
        {"_id": doc_id},
        {"$set": encrypted_payload}
    )

