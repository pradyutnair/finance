"""
Explicit Encryption Helpers for MongoDB (matches TypeScript implementation)

Uses MongoDB Client-Side Field Level Encryption with GCP KMS.
Works in serverless with bypass_auto_encryption mode.
"""

import os
from bson.binary import Binary

# Cache for data key ID
_data_key_id = None


def get_data_key_id():
    """Get or create data encryption key (matches TypeScript getDataKeyId)."""
    global _data_key_id
    
    if _data_key_id:
        return _data_key_id
    
    try:
        from .mongodb import get_mongo_client, get_client_encryption, get_key_vault_namespace
    except ImportError:
        from mongodb import get_mongo_client, get_client_encryption, get_key_vault_namespace
    
    client = get_mongo_client()
    client_encryption = get_client_encryption()
    key_vault_namespace = get_key_vault_namespace()
    kv_db, kv_coll = key_vault_namespace.split('.')
    
    key_alt_name = "nexpass-data-key"
    
    # Try to find existing key
    key_vault = client[kv_db][kv_coll]
    keys = list(key_vault.find({"keyAltNames": key_alt_name}))
    
    if keys:
        _data_key_id = keys[0]["_id"]
        print("🔑 Using existing data encryption key")
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


def encrypt_queryable(value):
    """
    Encrypt field for equality queries (deterministic encryption).
    Matches TypeScript: encryptQueryable()
    
    Returns Binary that auto-decrypts on read.
    """
    if value is None or value == "":
        return None
    
    try:
        from .mongodb import get_client_encryption
    except ImportError:
        from mongodb import get_client_encryption
    
    client_encryption = get_client_encryption()
    key_id = get_data_key_id()
    
    # Use deterministic encryption (same as TypeScript)
    encrypted = client_encryption.encrypt(
        str(value),
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
        key_id=key_id
    )
    
    return encrypted


def encrypt_random(value):
    """
    Encrypt field with random encryption (maximum security).
    Matches TypeScript: encryptRandom()
    
    Returns Binary that auto-decrypts on read.
    """
    if value is None or value == "":
        return None
    
    try:
        from .mongodb import get_client_encryption
    except ImportError:
        from mongodb import get_client_encryption
    
    string_value = str(value) if not isinstance(value, str) else value
    
    client_encryption = get_client_encryption()
    key_id = get_data_key_id()
    
    # Use random encryption (same as TypeScript)
    encrypted = client_encryption.encrypt(
        string_value,
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Random",
        key_id=key_id
    )
    
    return encrypted



