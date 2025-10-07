"""Helper functions for MongoDB Queryable Encryption setup."""

import os
import tempfile
from pathlib import Path
from appwrite.client import Client
from appwrite.services.storage import Storage

# Import encryption modules AFTER ensuring library is available
# These imports will be done inside functions

# Cache for the downloaded encryption library path
_cached_library_path = None


def download_encryption_library():
    """Download the MongoDB encryption library from Appwrite Storage and install it."""
    global _cached_library_path
    
    # Return cached path if already downloaded and configured
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
    
    library_filename = 'libmongocrypt.so'
    
    try:
        print(f"📥 Downloading MongoDB encryption library from Appwrite Storage (bucket: {bucket_id}, file: {file_id})...")
        
        # Get file download
        result = storage.get_file_download(bucket_id, file_id)
        
        # Try to install to pymongocrypt directory first
        try:
            import pymongocrypt
            pymongocrypt_dir = os.path.dirname(pymongocrypt.__file__)
            target_path = os.path.join(pymongocrypt_dir, library_filename)
            
            # Write to pymongocrypt directory
            with open(target_path, 'wb') as f:
                f.write(result)
            
            # Make it executable
            os.chmod(target_path, 0o755)
            
            print(f"✅ Successfully installed encryption library to pymongocrypt: {target_path}")
            _cached_library_path = target_path
            return target_path
            
        except (PermissionError, OSError) as e:
            print(f"⚠️  Cannot write to pymongocrypt directory: {e}")
            print(f"⚠️  Falling back to /tmp and LD_LIBRARY_PATH")
            
            # Fallback: Download to /tmp and set LD_LIBRARY_PATH
            temp_dir = tempfile.gettempdir()
            library_path = os.path.join(temp_dir, library_filename)
            
            with open(library_path, 'wb') as f:
                f.write(result)
            
            # Make it executable
            os.chmod(library_path, 0o755)
            
            # Add to LD_LIBRARY_PATH
            ld_library_path = os.environ.get('LD_LIBRARY_PATH', '')
            if temp_dir not in ld_library_path:
                if ld_library_path:
                    os.environ['LD_LIBRARY_PATH'] = f"{temp_dir}:{ld_library_path}"
                else:
                    os.environ['LD_LIBRARY_PATH'] = temp_dir
                print(f"✅ Added {temp_dir} to LD_LIBRARY_PATH")
            
            print(f"✅ Successfully downloaded encryption library to: {library_path}")
            _cached_library_path = library_path
            return library_path
        
    except Exception as e:
        # Fallback to local path if download fails
        library_path = os.path.join(os.path.dirname(__file__), library_filename)
        print(f"⚠️  Download failed, checking for local library at: {library_path}")
        if os.path.exists(library_path):
            print(f"✅ Using local MongoDB encryption library from: {library_path}")
            _cached_library_path = library_path
            return library_path
        else:
            print(f"❌ No local library found either. Error: {str(e)}")
            raise FileNotFoundError(
                f"Failed to download or find MongoDB encryption library: {str(e)}"
            )


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
    
    Note: We ensure libmongocrypt is available before importing pymongo encryption modules.
    """
    # Ensure libmongocrypt is available BEFORE importing pymongo
    try:
        download_encryption_library()
        print(f"✅ Encryption library ready")
    except Exception as e:
        print(f"⚠️  Warning: Could not download custom encryption library: {e}")
        print(f"⚠️  Will attempt to use bundled pymongocrypt library")
    
    # Import AFTER ensuring library is available
    from pymongo.encryption_options import AutoEncryptionOpts
    
    # start-auto-encryption-options
    # Don't specify crypt_shared_lib_path - let pymongo use bundled library
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


