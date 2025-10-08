"""Helper functions for MongoDB Queryable Encryption setup."""

import os


def check_encryption_library():
    """Check if libmongocrypt is available in the system.
    
    Note: libmongocrypt should be installed system-wide via apt-get or similar.
    See Dockerfile for installation instructions.
    """
    try:
        # Try to import pymongocrypt to verify library is available
        import pymongocrypt
        version = pymongocrypt.libmongocrypt_version()
        print(f"✅ libmongocrypt is available (version: {version})")
        return True
    except Exception as e:
        print(f"❌ libmongocrypt not available: {e}")
        print("❌ Make sure libmongocrypt-dev is installed in the Docker image")
        return False


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
    """Create AutoEncryptionOpts for the MongoDB client.
    
    Note: Requires libmongocrypt to be installed system-wide.
    """
    from pymongo.encryption_options import AutoEncryptionOpts
    
    # start-auto-encryption-options
    auto_encryption_options = AutoEncryptionOpts(
        kms_provider_credentials,
        key_vault_namespace
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
    # Import AFTER ensuring library is available
    from pymongo.encryption import ClientEncryption
    from bson.codec_options import CodecOptions
    from bson.binary import STANDARD
    
    # start-client-encryption
    client_encryption = ClientEncryption(
        kms_providers=kms_provider_credentials,
        key_vault_namespace=key_vault_namespace,
        key_vault_client=encrypted_client,
        codec_options=CodecOptions(uuid_representation=STANDARD)
    )
    # end-client-encryption
    return client_encryption


