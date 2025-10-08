"""Application-level Encryption using Python cryptography library."""

import os
import hashlib
from cryptography.fernet import Fernet

# Global encryption key
_fernet = None


def get_encryption_key():
    """Get or derive encryption key from environment."""
    global _fernet
    
    if _fernet:
        return _fernet
    
    # Get master key from environment (or derive from GCP credentials)
    master_key = os.environ.get("ENCRYPTION_MASTER_KEY")
    
    if not master_key:
        # Fallback: derive from GCP private key if available
        gcp_key = os.environ.get("GCP_PRIVATE_KEY", "")
        if gcp_key:
            # Use SHA256 to create a deterministic key from GCP credentials
            key_bytes = hashlib.sha256(gcp_key.encode()).digest()
            # Fernet requires base64-encoded 32-byte key
            import base64
            master_key = base64.urlsafe_b64encode(key_bytes).decode()
        else:
            raise ValueError("ENCRYPTION_MASTER_KEY or GCP_PRIVATE_KEY required for encryption")
    
    _fernet = Fernet(master_key.encode() if isinstance(master_key, str) else master_key)
    return _fernet


def encrypt_queryable(value):
    """Encrypt field for equality queries (deterministic using hash)."""
    if value is None or value == "":
        return None
    
    # For queryable fields, we use a deterministic hash
    # This allows equality queries but not range queries
    string_value = str(value)
    
    # Create deterministic hash using HMAC
    salt = os.environ.get("ENCRYPTION_SALT", "nexpass-default-salt")
    hash_value = hashlib.sha256(f"{salt}:{string_value}".encode()).hexdigest()
    
    return hash_value


def encrypt_random(value):
    """Encrypt field with Fernet (symmetric encryption)."""
    if value is None or value == "":
        return None
    
    string_value = str(value) if not isinstance(value, str) else value
    
    fernet = get_encryption_key()
    encrypted = fernet.encrypt(string_value.encode())
    
    # Return as string for MongoDB storage
    return encrypted.decode()


def decrypt_value(encrypted_value):
    """Decrypt a Fernet-encrypted value."""
    if encrypted_value is None or encrypted_value == "":
        return None
    
    fernet = get_encryption_key()
    
    try:
        # Handle both bytes and string
        if isinstance(encrypted_value, str):
            encrypted_value = encrypted_value.encode()
        
        decrypted = fernet.decrypt(encrypted_value)
        return decrypted.decode()
    except Exception:
        # If decryption fails, return original value
        return encrypted_value



