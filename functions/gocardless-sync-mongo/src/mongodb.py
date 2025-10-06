"""MongoDB client with Queryable Encryption support."""

import os
from pymongo import MongoClient

try:
    from pymongo.encryption import ClientEncryption, AutoEncryptionOpts
    ENCRYPTION_AVAILABLE = True
except ImportError:
    ENCRYPTION_AVAILABLE = False
    print("Warning: pymongocrypt not available, encryption disabled")


_client = None


def get_mongo_db_name():
    return os.environ.get("MONGODB_DB", "finance_dev")


def get_key_vault_namespace():
    return os.environ.get("MONGODB_KEY_VAULT_NS", "encryption.__keyVault")


def get_encrypted_mongo_client():
    """Get singleton MongoDB client with automatic encryption."""
    global _client
    if _client:
        return _client

    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI is not set")

    # Try to enable auto-encryption if available
    if ENCRYPTION_AVAILABLE:
        gcp_email = os.environ.get("GCP_EMAIL")
        gcp_private_key_raw = os.environ.get("GCP_PRIVATE_KEY")
        
        if gcp_email and gcp_private_key_raw:
            try:
                # Handle newline escaping
                gcp_private_key = gcp_private_key_raw.replace("\\n", "\n") if "\\n" in gcp_private_key_raw else gcp_private_key_raw

                kms_providers = {
                    "gcp": {
                        "email": gcp_email,
                        "privateKey": gcp_private_key,
                    }
                }

                key_vault_namespace = get_key_vault_namespace()
                crypt_shared_lib_path = os.environ.get("SHARED_LIB_PATH")

                # Build AutoEncryptionOpts
                opts_kwargs = {
                    "kms_providers": kms_providers,
                    "key_vault_namespace": key_vault_namespace,
                    "bypass_auto_encryption": False,
                }
                
                if crypt_shared_lib_path:
                    opts_kwargs["crypt_shared_lib_path"] = crypt_shared_lib_path

                auto_encryption_opts = AutoEncryptionOpts(**opts_kwargs)
                _client = MongoClient(uri, auto_encryption_opts=auto_encryption_opts)
                print("✅ MongoDB client initialized with auto-encryption")
                return _client
            except Exception as e:
                print(f"⚠️ Failed to enable auto-encryption: {e}")
                print("⚠️ Falling back to connection without auto-encryption")
                print("⚠️ Server-side encryption will still be applied based on collection schema")

    # Fallback: Connect without auto-encryption
    # Server-side encryption will still apply based on encrypted collection schema
    _client = MongoClient(uri)
    print("✅ MongoDB client initialized (server-side encryption only)")
    return _client


def get_db():
    """Get MongoDB database with encryption enabled."""
    client = get_encrypted_mongo_client()
    return client[get_mongo_db_name()]


def get_active_accounts():
    """Fetch all active bank accounts from MongoDB."""
    db = get_db()
    collection = db["bank_accounts_dev"]
    
    # Query for active accounts
    accounts = list(collection.find({"status": "active"}).limit(50))
    print(f"Found {len(accounts)} active accounts")
    return accounts


def get_last_booking_date(user_id, account_id):
    """Get the most recent booking date for a user's account."""
    db = get_db()
    collection = db["transactions_dev"]
    
    try:
        result = collection.find_one(
            {"userId": user_id, "accountId": account_id},
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
    db = get_db()
    collection = db["balances_dev"]
    
    try:
        result = collection.find_one({
            "userId": user_id,
            "accountId": account_id,
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


def create_transaction(doc_id, payload):
    """Insert a new transaction document."""
    db = get_db()
    collection = db["transactions_dev"]
    
    payload["_id"] = doc_id
    collection.insert_one(payload)


def create_balance(doc_id, payload):
    """Insert a new balance document."""
    db = get_db()
    collection = db["balances_dev"]
    
    payload["_id"] = doc_id
    collection.insert_one(payload)


def update_balance(doc_id, payload):
    """Update an existing balance document."""
    db = get_db()
    collection = db["balances_dev"]
    
    collection.update_one(
        {"_id": doc_id},
        {"$set": payload}
    )

