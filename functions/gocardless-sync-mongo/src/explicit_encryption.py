"""Explicit Encryption Helpers for MongoDB in Serverless Environments."""


def encrypt_queryable(value, client_encryption, data_key_id):
    """Encrypt field for equality queries (deterministic)."""
    if value is None or value == "":
        return None
    
    return client_encryption.encrypt(
        str(value),
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
        key_id=data_key_id
    )


def encrypt_random(value, client_encryption, data_key_id):
    """Encrypt field with random encryption (maximum security)."""
    if value is None or value == "":
        return None
    
    string_value = str(value) if not isinstance(value, str) else value
    
    return client_encryption.encrypt(
        string_value,
        algorithm="AEAD_AES_256_CBC_HMAC_SHA_512-Random",
        key_id=data_key_id
    )



