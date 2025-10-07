"""Helper functions for MongoDB Queryable Encryption setup."""

import os
from pymongo.encryption import AutoEncryptionOpts, ClientEncryption


def get_kms_provider_credentials(kms_provider_name="gcp"):
    """Get KMS provider credentials from environment variables."""
    if kms_provider_name == "gcp":
        gcp_private_key_raw = os.environ.get("GCP_PRIVATE_KEY", "")
        # Handle newline escaping
        gcp_private_key = gcp_private_key_raw.replace("\\n", "\n") if "\\n" in gcp_private_key_raw else gcp_private_key_raw
        
        return {
            "gcp": {
                "email": os.environ.get("GCP_EMAIL", ""),
                "privateKey": gcp_private_key,
            }
        }
    return {}


def get_customer_master_key_credentials(kms_provider_name="gcp"):
    """Get customer master key credentials for KMS."""
    if kms_provider_name == "gcp":
        return {
            "projectId": os.environ.get("GCP_PROJECT_ID", ""),
            "location": os.environ.get("GCP_LOCATION", "global"),
            "keyRing": os.environ.get("GCP_KEY_RING", ""),
            "keyName": os.environ.get("GCP_KEY_NAME", ""),
        }
    return {}


def get_auto_encryption_options(kms_provider_name, key_vault_namespace, kms_provider_credentials):
    """Create AutoEncryptionOpts for the MongoDB client."""
    crypt_shared_lib_path = "functions/gocardless-sync-mongo/src/mongo_crypt_v1.dylib"
    
    opts_kwargs = {
        "kms_providers": kms_provider_credentials,
        "key_vault_namespace": key_vault_namespace,
        "bypass_auto_encryption": False,
    }
    
    if crypt_shared_lib_path:
        opts_kwargs["crypt_shared_lib_path"] = crypt_shared_lib_path
    
    return AutoEncryptionOpts(**opts_kwargs)


def get_client_encryption(encrypted_client, kms_provider_name, kms_provider_credentials, key_vault_namespace):
    """Create a ClientEncryption instance for managing encryption keys."""
    return ClientEncryption(
        kms_providers=kms_provider_credentials,
        key_vault_namespace=key_vault_namespace,
        key_vault_client=encrypted_client,
        codec_options=None
    )


