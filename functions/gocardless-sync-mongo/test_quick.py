#!/usr/bin/env python3
"""Quick test to verify encryption setup works."""

import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    print("⚠️  python-dotenv not installed, using existing env vars")

def test_encryption():
    """Test that encryption can be set up."""
    print("=" * 60)
    print("MongoDB Encryption Quick Test")
    print("=" * 60)
    
    # Test imports
    print("\n1️⃣  Testing imports...")
    try:
        from pymongo.encryption import AutoEncryptionOpts
        print("   ✅ pymongo.encryption available")
    except ImportError as e:
        print(f"   ❌ Failed: {e}")
        return False
    
    try:
        import encryption_helpers
        print("   ✅ encryption_helpers loaded")
    except ImportError as e:
        print(f"   ❌ Failed: {e}")
        return False
    
    # Test library path
    print("\n2️⃣  Testing encryption library...")
    try:
        current_dir = Path(__file__).parent / "src"
        lib_path = current_dir / "mongo_crypt_v1.dylib"
        if lib_path.exists():
            size_mb = lib_path.stat().st_size / (1024 * 1024)
            print(f"   ✅ Library found: {lib_path} ({size_mb:.1f} MB)")
        else:
            print(f"   ❌ Library not found at: {lib_path}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test encryption options creation
    print("\n3️⃣  Testing encryption options...")
    try:
        kms_creds = encryption_helpers.get_kms_provider_credentials("gcp")
        print("   ✅ KMS credentials configured")
        
        key_vault_ns = os.environ.get("MONGODB_KEY_VAULT_NS", "encryption.__keyVault")
        auto_opts = encryption_helpers.get_auto_encryption_options(
            "gcp",
            key_vault_ns,
            kms_creds
        )
        print("   ✅ AutoEncryptionOpts created successfully")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test MongoDB connection
    print("\n4️⃣  Testing MongoDB connection...")
    try:
        from mongodb import get_encrypted_mongo_client, get_db
        
        client = get_encrypted_mongo_client()
        print("   ✅ Encrypted client created")
        
        db = get_db()
        db.command('ping')
        print("   ✅ Database connection successful")
        
        collections = db.list_collection_names()
        print(f"   ✅ Collections: {len(collections), collections} found")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_encryption()
    sys.exit(0 if success else 1)
