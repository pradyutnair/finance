"""MongoDB client with Queryable Encryption support."""

import os
from pymongo import MongoClient

try:
    from pymongo.encryption import ClientEncryption, AutoEncryptionOpts
    try:
        # Try relative import first (for Appwrite function runtime)
        from . import encryption_helpers as helpers
    except ImportError:
        # Fall back to direct import (for local testing)
        import encryption_helpers as helpers
    
    # Check if libmongocrypt is available system-wide
    ENCRYPTION_AVAILABLE = helpers.check_encryption_library()
except ImportError as e:
    ENCRYPTION_AVAILABLE = False
    helpers = None
    print(f"❌ pymongo.encryption not available: {e}")
    print("❌ Install with: pip install 'pymongo[encryption]'")


_client = None
_kms_provider_name = "gcp"


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
        gcp_private_key = os.environ.get("GCP_PRIVATE_KEY")
        
        if not gcp_email or not gcp_private_key:
            print("⚠️ GCP credentials not found in environment variables")
            print("⚠️ Required: GCP_EMAIL, GCP_PRIVATE_KEY")
            raise ValueError("GCP KMS credentials required for client-side encryption")
        
        try:
            print("🔐 Setting up client-side encryption...")
            key_vault_namespace = get_key_vault_namespace()
            print(f"🔑 Key vault namespace: {key_vault_namespace}")
            
            # Get KMS provider credentials using helper (matches reference code)
            kms_provider_credentials = helpers.get_kms_provider_credentials(_kms_provider_name)
            print(f"🔑 KMS provider: {_kms_provider_name}")
            
            # Get auto-encryption options using helper (matches reference code)
            auto_encryption_options = helpers.get_auto_encryption_options(
                _kms_provider_name,
                key_vault_namespace,
                kms_provider_credentials,
            )
            print("🔑 Auto-encryption options configured")
            
            # Create encrypted client (matches reference code: MongoClient(uri, auto_encryption_opts=...))
            _client = MongoClient(uri, auto_encryption_opts=auto_encryption_options)
            print("✅ MongoDB client initialized with auto-encryption enabled")
            return _client
        except FileNotFoundError as e:
            print(f"❌ Encryption library not found: {e}")
            raise
        except Exception as e:
            print(f"❌ Failed to enable auto-encryption: {e}")
            print(f"❌ Error type: {type(e).__name__}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
            raise RuntimeError(f"Client-side encryption is required but failed: {e}")
    
    # If encryption is not available, fail fast
    print("❌ pymongo.encryption module not available")
    print("❌ Client-side encryption is required for this MongoDB schema")
    raise RuntimeError("Client-side encryption required but pymongo[encryption] not available")


def get_db():
    """Get MongoDB database with encryption enabled."""
    client = get_encrypted_mongo_client()
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
    
    # Query for active accounts; if status is encrypted/unqueryable, fall back to all
    accounts = list(collection.find({"status": "active"}).limit(50))
    if len(accounts) == 0:
        print("⚠️ No accounts matched status: 'active'. Falling back to all accounts (limit 50)")
        accounts = list(collection.find({}).limit(50))
    print(f"Found {len(accounts)} accounts to process (out of {total_count} total)")
    
    if len(accounts) == 0 and total_count > 0:
        # Try to fetch any accounts to see what's available
        sample_account = collection.find_one({})
        if sample_account:
            print(f"Sample account status: {sample_account.get('status', 'NO STATUS FIELD')}")
            print(f"Sample account fields: {list(sample_account.keys())}")
    
    return accounts


def get_user_requisitions(user_id: str):
    """Return requisitions for a given userId from requisitions_dev.
    Note: requisition fields are encrypted; only userId is plaintext.
    """
    db = get_db()
    collection = db["requisitions_dev"]
    return list(collection.find({"userId": user_id}))


def get_user_bank_accounts(user_id: str):
    """Return bank accounts for a given userId from bank_accounts_dev.
    Note: most fields are encrypted; only userId is plaintext.
    """
    db = get_db()
    collection = db["bank_accounts_dev"]
    return list(collection.find({"userId": user_id}))


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

