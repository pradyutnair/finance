"""
Explicit Encryption Helpers for MongoDB in Serverless Environments

This module provides functions to manually encrypt sensitive data before storing in MongoDB.
Uses bypassAutoEncryption mode for compatibility with Appwrite Cloud Functions.

Key Features:
- Explicit encryption before writes (manual)
- Automatic decryption on reads (handled by MongoDB driver)
- Queryable equality encryption (deterministic) for fields we need to query
- Random encryption for maximum security on non-queryable fields
- No mongocryptd or shared library dependencies
"""

import os
from bson.binary import Binary, STANDARD
from pymongo.encryption import ClientEncryption

# Global client encryption instance
_client_encryption = None
_data_key_id = None


def get_kms_providers():
    """Get KMS provider credentials from environment variables."""
    gcp_email = os.environ.get("GCP_EMAIL")
    gcp_private_key = os.environ.get("GCP_PRIVATE_KEY")
    
    if not gcp_email or not gcp_private_key:
        raise ValueError("GCP_EMAIL and GCP_PRIVATE_KEY are required for encryption")
    
    return {
        "gcp": {
            "email": gcp_email,
            "privateKey": gcp_private_key
        }
    }


def get_key_vault_namespace():
    """Get key vault namespace from environment."""
    return os.environ.get("MONGODB_KEY_VAULT_NS", "encryption.__keyVault")


def get_client_encryption(mongo_client):
    """Get or create ClientEncryption instance."""
    global _client_encryption
    
    if _client_encryption:
        return _client_encryption
    
    kms_providers = get_kms_providers()
    key_vault_namespace = get_key_vault_namespace()
    
    _client_encryption = ClientEncryption(
        kms_providers=kms_providers,
        key_vault_namespace=key_vault_namespace,
        key_vault_client=mongo_client,
        codec_options=None
    )
    
    return _client_encryption


def get_data_key_id(client_encryption, mongo_client):
    """Get or create data encryption key."""
    global _data_key_id
    
    if _data_key_id:
        return _data_key_id
    
    key_vault_namespace = get_key_vault_namespace()
    kv_db, kv_coll = key_vault_namespace.split('.')
    
    key_alt_name = "nexpass-data-key"
    
    # Try to find existing key
    key_vault = mongo_client[kv_db][kv_coll]
    keys = list(key_vault.find({"keyAltNames": key_alt_name}))
    
    if keys:
        _data_key_id = keys[0]["_id"]
        print(f"🔑 Using existing data encryption key")
        return _data_key_id
    
    # Create new key if not found
    print("🔑 Creating new data encryption key...")
    gcp_master_key = {
        "projectId": os.environ.get("GCP_PROJECT_ID"),
        "location": os.environ.get("GCP_LOCATION"),
        "keyRing": os.environ.get("GCP_KEY_RING"),
        "keyName": os.environ.get("GCP_KEY_NAME"),
    }
    
    _data_key_id = client_encryption.create_data_key(
        "gcp",
        master_key=gcp_master_key,
        key_alt_names=[key_alt_name]
    )
    
    print("✅ Created data encryption key")
    return _data_key_id


def encrypt_queryable(value, client_encryption, data_key_id):
    """
    Encrypt a field value for equality queries (deterministic encryption).
    Use this for fields you need to query with equality (e.g., transactionId, requisitionId).
    """
    if value is None or value == "":
        return None
    
    # Convert to string for encryption
    string_value = str(value)
    
    # Use deterministic encryption for queryable fields
    encrypted = client_encryption.encrypt(
        string_value,
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
        key_id=data_key_id
    )
    
    return encrypted


def encrypt_random(value, client_encryption, data_key_id):
    """
    Encrypt a field value with random encryption (maximum security).
    Use this for sensitive fields that don't need to be queried.
    """
    if value is None or value == "":
        return None
    
    # Convert to string for encryption
    string_value = str(value) if not isinstance(value, str) else value
    
    # Use random encryption for non-queryable fields (more secure)
    encrypted = client_encryption.encrypt(
        string_value,
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Random",
        key_id=data_key_id
    )
    
    return encrypted


def encrypt_transaction_fields(user_id, account_id, transaction, category, client_encryption, data_key_id):
    """Helper to encrypt transaction fields."""
    tx_description = (
        transaction.get("remittanceInformationUnstructured") 
        or transaction.get("additionalInformation") 
        or ""
    )
    counterparty = transaction.get("creditorName") or transaction.get("debtorName") or ""
    provider_tx_id = transaction.get("transactionId") or transaction.get("internalTransactionId") or ""
    
    tx_amount = transaction.get("transactionAmount", {})
    amount = tx_amount.get("amount") if isinstance(tx_amount, dict) else None
    currency = tx_amount.get("currency") if isinstance(tx_amount, dict) else "EUR"
    
    doc = {
        # Plaintext fields (needed for queries)
        "userId": user_id,
        "category": category,
        "exclude": False,
        "bookingDate": transaction.get("bookingDate", "")[:10] if transaction.get("bookingDate") else None,
        
        # Encrypted queryable fields (deterministic - for account/transaction lookups)
        "accountId": encrypt_queryable(account_id, client_encryption, data_key_id),
        "transactionId": encrypt_queryable(provider_tx_id, client_encryption, data_key_id),
        
        # Encrypted sensitive fields (random - maximum security)
        "amount": encrypt_random(amount, client_encryption, data_key_id),
        "currency": encrypt_random(str(currency).upper()[:3], client_encryption, data_key_id),
        "bookingDateTime": encrypt_random(
            transaction.get("bookingDateTime", "")[:25] if transaction.get("bookingDateTime") else None,
            client_encryption,
            data_key_id
        ),
        "valueDate": encrypt_random(
            transaction.get("valueDate", "")[:10] if transaction.get("valueDate") else None,
            client_encryption,
            data_key_id
        ),
        "description": encrypt_random(tx_description[:500] if tx_description else None, client_encryption, data_key_id),
        "counterparty": encrypt_random(counterparty[:255] if counterparty else None, client_encryption, data_key_id),
        "raw": encrypt_random(str(transaction)[:10000], client_encryption, data_key_id),
    }
    
    # Filter out None values
    return {k: v for k, v in doc.items() if v is not None}


def encrypt_balance_fields(user_id, account_id, balance, client_encryption, data_key_id):
    """Helper to encrypt balance fields."""
    balance_type = balance.get("balanceType", "closingBooked")
    reference_date = balance.get("referenceDate") or ""
    
    balance_amount = balance.get("balanceAmount", {})
    amount = balance_amount.get("amount", "0") if isinstance(balance_amount, dict) else "0"
    currency = balance_amount.get("currency", "EUR") if isinstance(balance_amount, dict) else "EUR"
    
    doc = {
        # Plaintext fields (needed for queries)
        "userId": user_id,
        "balanceType": balance_type,
        "referenceDate": reference_date,
        
        # Encrypted queryable field (deterministic - for account lookups)
        "accountId": encrypt_queryable(account_id, client_encryption, data_key_id),
        
        # Encrypted sensitive fields (random - maximum security)
        "balanceAmount": encrypt_random(str(amount), client_encryption, data_key_id),
        "currency": encrypt_random(str(currency).upper()[:3], client_encryption, data_key_id),
    }
    
    # Filter out None values
    return {k: v for k, v in doc.items() if v is not None}

