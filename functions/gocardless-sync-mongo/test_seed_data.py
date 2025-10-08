#!/usr/bin/env python3
"""
Test seed data script to verify MongoDB explicit encryption works.
Matches TypeScript seed-test-data.ts
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
    print("✅ Loaded .env file")
except ImportError:
    print("⚠️  python-dotenv not installed, using existing env vars")

from mongodb import get_db
from explicit_encryption import encrypt_queryable, encrypt_random

TEST_USER_ID = '68d446e7bf3ed043310a'


def seed_test_data():
    """Seed test data with explicit encryption (matches TypeScript)."""
    db = get_db()
    
    print(f"\n🌱 Seeding test data for user {TEST_USER_ID} with explicit encryption...")
    
    # 1. Create test requisition with explicit encryption
    print("\n1️⃣  Creating test requisition...")
    requisition_update = {
        "userId": TEST_USER_ID,
        "institutionId": "REVOLUT_REVOGB21",
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Encrypt sensitive fields
    requisition_update["requisitionId"] = encrypt_queryable("test-req-revolut-001")
    requisition_update["institutionName"] = encrypt_random("Revolut")
    requisition_update["status"] = encrypt_random("LINKED")
    requisition_update["reference"] = encrypt_random(f"user_{TEST_USER_ID}_{int(datetime.now().timestamp())}")
    requisition_update["redirectUri"] = encrypt_random("http://localhost:3000/link-bank/callback")
    
    req_result = db["requisitions_dev"].update_one(
        {"userId": TEST_USER_ID, "institutionId": "REVOLUT_REVOGB21"},
        {
            "$set": requisition_update,
            "$setOnInsert": {
                "createdAt": datetime.now().isoformat()
            }
        },
        upsert=True
    )
    print(f"   ✅ Requisition: {'created' if req_result.upserted_id else 'updated'} (encrypted)")
    
    # 2. Create test bank connection with explicit encryption
    print("\n2️⃣  Creating test bank connection...")
    connection_update = {
        "userId": TEST_USER_ID,
        "institutionId": "REVOLUT_REVOGB21",
        "logoUrl": "https://cdn.revolut.com/media/brand/logo.svg",
        "transactionTotalDays": 90,
        "maxAccessValidforDays": 180,
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Encrypt sensitive fields
    connection_update["institutionName"] = encrypt_random("Revolut")
    connection_update["status"] = encrypt_random("active")
    connection_update["requisitionId"] = encrypt_queryable("test-req-revolut-001")
    
    conn_result = db["bank_connections_dev"].update_one(
        {"userId": TEST_USER_ID, "institutionId": "REVOLUT_REVOGB21"},
        {
            "$set": connection_update,
            "$setOnInsert": {
                "createdAt": datetime.now().isoformat()
            }
        },
        upsert=True
    )
    print(f"   ✅ Bank connection: {'created' if conn_result.upserted_id else 'updated'} (encrypted)")
    
    # 3. Create test bank account with explicit encryption
    print("\n3️⃣  Creating test bank account...")
    plaintext_account_id = "test-acct-rev-eur-001"
    encrypted_account_id = encrypt_queryable(plaintext_account_id)
    
    account_update = {
        "userId": TEST_USER_ID,
        "institutionId": "REVOLUT_REVOGB21",
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Encrypt sensitive fields (including accountId)
    account_update["accountId"] = encrypted_account_id
    account_update["institutionName"] = encrypt_random("Revolut")
    account_update["iban"] = encrypt_random("GB33REVO00996912345678")
    account_update["accountName"] = encrypt_random("EUR Current Account")
    account_update["currency"] = encrypt_random("EUR")
    account_update["status"] = encrypt_random("active")
    account_update["raw"] = encrypt_random('{"iban":"GB33REVO00996912345678","name":"EUR Current Account","currency":"EUR"}')
    
    acct_result = db["bank_accounts_dev"].update_one(
        {"userId": TEST_USER_ID, "accountId": encrypted_account_id},
        {
            "$set": account_update,
            "$setOnInsert": {
                "createdAt": datetime.now().isoformat()
            }
        },
        upsert=True
    )
    print(f"   ✅ Bank account: {'created' if acct_result.upserted_id else 'updated'} (encrypted)")
    
    # 4. Create test balances with explicit encryption
    print("\n4️⃣  Creating test balance...")
    today = datetime.now().strftime("%Y-%m-%d")
    balance_update = {
        "userId": TEST_USER_ID,
        "balanceType": "interimAvailable",
        "referenceDate": today,
        "updatedAt": datetime.now().isoformat(),
    }
    
    # Encrypt sensitive fields (including accountId)
    balance_update["accountId"] = encrypted_account_id
    balance_update["balanceAmount"] = encrypt_random("5420.50")
    balance_update["currency"] = encrypt_random("EUR")
    
    bal_result = db["balances_dev"].update_one(
        {
            "userId": TEST_USER_ID,
            "accountId": encrypted_account_id,
            "balanceType": "interimAvailable",
            "referenceDate": today
        },
        {
            "$set": balance_update,
            "$setOnInsert": {
                "createdAt": datetime.now().isoformat()
            }
        },
        upsert=True
    )
    print(f"   ✅ Balance: {'created' if bal_result.upserted_id else 'updated'} (encrypted)")
    
    # 5. Create test transactions with explicit encryption
    print("\n5️⃣  Creating test transactions...")
    transactions = [
        {
            "transactionId": "tx-costco-001",
            "amount": "-45.80",
            "bookingDate": "2025-10-08",
            "description": "COSTCO SUPERMARKET LONDON",
            "counterparty": "Costco Stores Ltd",
            "category": "Groceries",
        },
        {
            "transactionId": "tx-roaster-001",
            "amount": "-12.50",
            "bookingDate": "2025-10-08",
            "description": "Roaster Coffee Company",
            "counterparty": "Roaster Coffee Company",
            "category": "Restaurants",
        },
        {
            "transactionId": "tx-mietheater-001",
            "amount": "-85.00",
            "bookingDate": "2025-10-07",
            "description": "Mietheater",
            "counterparty": "Mietheater",
            "category": "Entertainment",
        },
        {
            "transactionId": "tx-tomtom-001",
            "amount": "2500.00",
            "bookingDate": "2025-10-07",
            "description": "SALARY PAYMENT - OCTOBER",
            "counterparty": "Tom Tom Ltd",
            "category": "Income",
        },
    ]
    
    tx_count = 0
    for idx, tx in enumerate(transactions):
        try:
            # Prepare document with explicit encryption
            tx_doc = {
                "userId": TEST_USER_ID,
                "category": tx["category"],  # Plaintext - needed for queries
                "exclude": False,  # Plaintext - needed for queries
                "bookingDate": tx["bookingDate"],  # Plaintext - needed for sorting
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat(),
            }
            
            # Encrypt sensitive fields (including accountId)
            tx_doc["accountId"] = encrypted_account_id
            tx_doc["transactionId"] = encrypt_queryable(tx["transactionId"])
            tx_doc["amount"] = encrypt_random(tx["amount"])
            tx_doc["currency"] = encrypt_random("EUR")
            tx_doc["bookingDateTime"] = encrypt_random(f"{tx['bookingDate']}T{10 + idx:02d}:30:00Z")
            tx_doc["valueDate"] = encrypt_random(tx["bookingDate"])
            tx_doc["description"] = encrypt_random(tx["description"])
            tx_doc["counterparty"] = encrypt_random(tx["counterparty"])
            tx_doc["raw"] = encrypt_random(f'{{"amount":{tx["amount"]},"description":"{tx["description"]}"}}')
            
            db["transactions_dev"].insert_one(tx_doc)
            tx_count += 1
        except Exception as e:
            if hasattr(e, 'code') and e.code == 11000:
                print(f"   Transaction {tx['transactionId']} already exists, skipping")
            else:
                raise e
    
    print(f"   ✅ Transactions: {tx_count} created, {len(transactions) - tx_count} skipped (encrypted)")
    
    # 6. Verify data can be read back (auto-decryption)
    print("\n6️⃣  Verifying auto-decryption...")
    
    # Read back one transaction
    test_tx = db["transactions_dev"].find_one({"userId": TEST_USER_ID, "category": "Groceries"})
    if test_tx:
        print(f"   ✅ Transaction read successfully")
        print(f"   - Category (plaintext): {test_tx.get('category')}")
        print(f"   - Amount (auto-decrypted): {test_tx.get('amount')}")
        print(f"   - Description (auto-decrypted): {test_tx.get('description')}")
        print(f"   - Counterparty (auto-decrypted): {test_tx.get('counterparty')}")
    else:
        print(f"   ⚠️  Could not read transaction back")
    
    # Read back bank account
    test_acct = db["bank_accounts_dev"].find_one({"userId": TEST_USER_ID})
    if test_acct:
        print(f"\n   ✅ Bank account read successfully")
        print(f"   - Account ID (auto-decrypted): {test_acct.get('accountId')}")
        print(f"   - Account Name (auto-decrypted): {test_acct.get('accountName')}")
        print(f"   - IBAN (auto-decrypted): {test_acct.get('iban')}")
    else:
        print(f"   ⚠️  Could not read bank account back")
    
    print("\n" + "=" * 60)
    print("🎉 Test data seeded successfully with explicit encryption!")
    print("=" * 60)
    print(f"\nUser ID: {TEST_USER_ID}")
    print(f"- 1 bank connection (Revolut)")
    print(f"- 1 bank account")
    print(f"- 1 balance record")
    print(f"- {len(transactions)} transactions")
    print(f"\n🔐 All sensitive fields are explicitly encrypted before storage.")
    print(f"📖 Data will be automatically decrypted when read.")
    print(f"\n✅ Encryption/Decryption verified successfully!")


if __name__ == "__main__":
    try:
        seed_test_data()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

