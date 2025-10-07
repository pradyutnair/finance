"""Helper functions for MongoDB Queryable Encryption setup."""

import os
import tempfile
from pathlib import Path
from appwrite.client import Client
from appwrite.services.storage import Storage
from pymongo.encryption import ClientEncryption
from pymongo.encryption_options import AutoEncryptionOpts
from bson.codec_options import CodecOptions
from bson.binary import STANDARD

# Cache for the downloaded encryption library path
_cached_library_path = None


def download_encryption_library():
    """Download the MongoDB encryption library from Appwrite Storage and cache it."""
    global _cached_library_path
    
    # Return cached path if already downloaded
    if _cached_library_path and os.path.exists(_cached_library_path):
        return _cached_library_path
    
    # Initialize Appwrite client
    client = Client()
    client.set_endpoint(os.environ.get('APPWRITE_ENDPOINT', 'https://fra.cloud.appwrite.io/v1'))
    client.set_project(os.environ.get('APPWRITE_PROJECT_ID', '68d3cfe5001f03d5c030'))
    client.set_key(os.environ.get('APPWRITE_API_KEY', ''))
    
    storage = Storage(client)
    
    # Download the encryption library from Appwrite Storage
    bucket_id = os.environ.get('MONGO_LIB_BUCKET_ID', 'mongo-lib')
    file_id = os.environ.get('MONGO_LIB_FILE_ID', 'libmongocrypt.so')
    
    # Create a temporary directory for the library
    temp_dir = tempfile.gettempdir()
    library_filename = 'libmongocrypt.so'
    try:
        library_path = os.path.join(temp_dir, library_filename)
        
        # Download the file if it doesn't exist in temp
        if not os.path.exists(library_path):
            print(f"Downloading MongoDB encryption library from Appwrite Storage (bucket: {bucket_id}, file: {file_id})...")
            try:
                # Get file download
                result = storage.get_file_download(bucket_id, file_id)
                
                # Write to temporary location
                with open(library_path, 'wb') as f:
                    f.write(result)
                
                print(f"Successfully downloaded encryption library to: {library_path}")
            except Exception as e:
                raise FileNotFoundError(
                    f"Failed to download MongoDB encryption library from Appwrite Storage: {str(e)}"
                )
        else:
            print(f"Using cached MongoDB encryption library from: {library_path}")
        
        # Cache the path
        _cached_library_path = library_path
    except Exception as e:
        library_path = os.path.join(os.path.dirname(__file__), library_filename)
        print(f"Using local MongoDB encryption library from: {library_path}")
    return library_path


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
    # Download encryption library from Appwrite Storage
    shared_lib_path = download_encryption_library()
    
    # Verify the library exists
    if not os.path.exists(shared_lib_path):
        raise FileNotFoundError(
            f"MongoDB encryption library not found at: {shared_lib_path}. "
            f"Failed to download from Appwrite Storage."
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


