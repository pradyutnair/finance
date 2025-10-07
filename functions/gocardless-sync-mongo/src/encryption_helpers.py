"""Helper functions for MongoDB Queryable Encryption setup."""

import os
from pymongo.encryption import ClientEncryption
from pymongo.encryption_options import AutoEncryptionOpts
from bson.codec_options import CodecOptions
from bson.binary import STANDARD


def get_kms_provider_credentials(kms_provider_name):
    """Get KMS provider credentials from environment variables."""
    if kms_provider_name == "gcp":
        # start-gcp-kms-credentials
        kms_provider_credentials = {
            "gcp": {
                "email": os.environ['GCP_EMAIL'],  # Your GCP email
                "privateKey": os.environ['GCP_PRIVATE_KEY']  # Your GCP private key
            }
        }
        # end-gcp-kms-credentials
        return kms_provider_credentials
    else:
        raise ValueError(
            "Unrecognized value for kms_provider_name encountered while retrieving KMS credentials.")


def get_customer_master_key_credentials(kms_provider_name):
    """Get customer master key credentials for KMS."""
    if kms_provider_name == "gcp":
        # start-gcp-cmk-credentials
        customer_master_key_credentials = {
            "projectId": os.environ['GCP_PROJECT_ID'],  # Your GCP project ID
            "location": os.environ['GCP_LOCATION'],  # Your GCP location
            "keyRing": os.environ['GCP_KEY_RING'],  # Your GCP key ring
            "keyName": os.environ['GCP_KEY_NAME']  # Your GCP key name
        }
        # end-gcp-cmk-credentials
        return customer_master_key_credentials
    else:
        raise ValueError(
            "Unrecognized value for kms_provider_name encountered while retrieving Customer Master Key credentials.")


def get_auto_encryption_options(
        kms_provider_name,
        key_vault_namespace,
        kms_provider_credentials,
):
    """Create AutoEncryptionOpts for the MongoDB client."""
    # Get shared library path from environment variable, with fallback to absolute path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    shared_lib_path = os.path.join(current_dir, "mongo_cryptv1._tdylib")

    # Verify the library exists
    if not os.path.exists(shared_lib_path):
        raise FileNotFoundError(
            f"MongoDB encryption library not found at: {shared_lib_path}. "
            f"Set SHARED_LIB_PATH environment variable or ensure mongo_crypt_v1.dylib is in the src/ directory."
        )
    
    # start-auto-encryption-options
    auto_encryption_options = AutoEncryptionOpts(
        kms_provider_credentials,
        key_vault_namespace,
        crypt_shared_lib_path=shared_lib_path  # Path to your Automatic Encryption Shared Library
    )
    # end-auto-encryption-options
    return auto_encryption_options


def get_client_encryption(
        encrypted_client,
        kms_provider_name,
        kms_provider_credentials,
        key_vault_namespace
):
    """Create a ClientEncryption instance for managing encryption keys."""
    # start-client-encryption
    client_encryption = ClientEncryption(
        kms_providers=kms_provider_credentials,
        key_vault_namespace=key_vault_namespace,
        key_vault_client=encrypted_client,
        codec_options=CodecOptions(uuid_representation=STANDARD)
    )
    # end-client-encryption
    return client_encryption


