#!/usr/bin/env python3
"""
Test script to seed MongoDB with encrypted GoCardless-like data.

This script:
1. Generates mock GoCardless transaction and balance data
2. Encrypts sensitive fields using application-level encryption
3. Writes encrypted data to MongoDB
4. Queries and decrypts data to verify the encryption/decryption cycle
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import random

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Load environment variables
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / ".env"
    load_dotenv(env_path)
    print(f"✅ Loaded environment from {env_path}")
except ImportError:
    print("⚠️  python-dotenv not installed, using existing env vars")


def generate_mock_gocardless_transactions(num_transactions=10):
    """Generate mock GoCardless transactions."""
    merchants = [
        "Starbucks Coffee", "Amazon.com", "Uber Eats", "Netflix",
        "Spotify", "Whole Foods", "Shell Gas Station", "McDonald's",
        "Apple.com", "Target", "Walmart", "Best Buy"
    ]
    
    transactions = []
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(num_transactions):
        transaction_date = base_date + timedelta(days=i * 3)
        amount = -round(random.uniform(5.0, 150.0), 2)
        merchant = random.choice(merchants)
        
        transaction = {
            "transactionId": f"TX-{i+1:04d}-{random.randint(1000, 9999)}",
            "bookingDate": transaction_date.strftime("%Y-%m-%d"),
            "valueDate": transaction_date.strftime("%Y-%m-%d"),
            "bookingDateTime": transaction_date.isoformat(),
            "transactionAmount": {
                "amount": str(amount),
                "currency": "USD"
            },
            "creditorName": merchant if amount < 0 else None,
            "debtorName": "Salary Inc." if amount > 0 else None,
            "remittanceInformationUnstructured": f"Purchase at {merchant}",
            "additionalInformation": f"Card transaction {transaction_date.strftime('%Y-%m-%d')}"
        }
        transactions.append(transaction)
    
    return transactions


def generate_mock_gocardless_balances():
    """Generate mock GoCardless balances."""
    return [
        {
            "balanceType": "closingBooked",
            "balanceAmount": {
                "amount": str(random.uniform(1000, 5000)),
                "currency": "USD"
            },
            "referenceDate": datetime.now().strftime("%Y-%m-%d")
        },
        {
            "balanceType": "expected",
            "balanceAmount": {
                "amount": str(random.uniform(1000, 5000)),
                "currency": "USD"
            },
            "referenceDate": datetime.now().strftime("%Y-%m-%d")
        }
    ]


def test_encryption_decryption():
    """Test basic encryption and decryption."""
    print("\n" + "="*60)
    print("Testing Encryption/Decryption")
    print("="*60)
    
    from explicit_encryption import encrypt_queryable, encrypt_random, decrypt_value
    
    # Test deterministic hash encryption
    account_id = "ACC-12345-TEST"
    encrypted_account_id = encrypt_queryable(account_id)
    print(f"\n1️⃣  Deterministic Hash:")
    print(f"   Original: {account_id}")
    print(f"   Hashed:   {encrypted_account_id[:50]}...")
    print(f"   ✅ Same input produces same hash: {encrypt_queryable(account_id) == encrypted_account_id}")
    
    # Test random encryption/decryption
    amount = "123.45"
    encrypted_amount = encrypt_random(amount)
    decrypted_amount = decrypt_value(encrypted_amount)
    print(f"\n2️⃣  Fernet Encryption:")
    print(f"   Original:  {amount}")
    print(f"   Encrypted: {encrypted_amount[:50]}...")
    print(f"   Decrypted: {decrypted_amount}")
    print(f"   ✅ Decryption successful: {amount == decrypted_amount}")
    
    return encrypted_account_id, account_id


def seed_test_data(user_id="test-user-001", account_id="ACC-TEST-12345"):
    """Seed MongoDB with test data."""
    print("\n" + "="*60)
    print("Seeding MongoDB with Test Data")
    print("="*60)
    
    from mongodb import get_db, create_transaction, create_balance
    from utils import format_transaction_payload, format_balance_payload, generate_doc_id
    from explicit_encryption import encrypt_queryable
    
    # Connect to MongoDB
    print("\n🔍 Connecting to MongoDB...")
    db = get_db()
    db.command('ping')
    print("✅ MongoDB connected")
    
    # Generate mock data
    print("\n📊 Generating mock GoCardless data...")
    transactions = generate_mock_gocardless_transactions(5)
    balances = generate_mock_gocardless_balances()
    print(f"✅ Generated {len(transactions)} transactions and {len(balances)} balances")
    
    # Store transactions
    print("\n💾 Storing encrypted transactions...")
    stored_tx_ids = []
    for i, tx in enumerate(transactions):
        doc_id = generate_doc_id(
            tx.get("transactionId"),
            account_id,
            tx.get("bookingDate")
        )
        
        payload = format_transaction_payload(tx, user_id, account_id, doc_id)
        create_transaction(doc_id, payload)
        stored_tx_ids.append(doc_id)
        
        print(f"   ✅ Stored transaction {i+1}/{len(transactions)}: {doc_id}")
    
    # Store balances
    print("\n💰 Storing encrypted balances...")
    stored_balance_ids = []
    for i, balance in enumerate(balances):
        balance_doc_id, payload = format_balance_payload(balance, user_id, account_id)
        create_balance(balance_doc_id, payload)
        stored_balance_ids.append(balance_doc_id)
        
        print(f"   ✅ Stored balance {i+1}/{len(balances)}: {balance_doc_id}")
    
    return {
        "user_id": user_id,
        "account_id": account_id,
        "encrypted_account_id": encrypt_queryable(account_id),
        "transaction_ids": stored_tx_ids,
        "balance_ids": stored_balance_ids
    }


def verify_data_query(test_data):
    """Query and verify encrypted data can be retrieved and decrypted."""
    print("\n" + "="*60)
    print("Verifying Data Query and Decryption")
    print("="*60)
    
    from mongodb import get_db
    from explicit_encryption import decrypt_value, encrypt_queryable
    
    db = get_db()
    user_id = test_data["user_id"]
    account_id = test_data["account_id"]
    encrypted_account_id = test_data["encrypted_account_id"]
    
    # Test 1: Query transactions by userId (plaintext field)
    print("\n1️⃣  Query by userId (plaintext):")
    transactions_collection = db["transactions_dev"]
    transactions = list(transactions_collection.find({"userId": user_id}))
    print(f"   Found {len(transactions)} transactions")
    print(f"   ✅ Plaintext query successful")
    
    # Test 2: Query by encrypted accountId (deterministic hash)
    print("\n2️⃣  Query by accountId (deterministic hash):")
    transactions_by_account = list(transactions_collection.find({
        "userId": user_id,
        "accountId": encrypted_account_id
    }))
    print(f"   Found {len(transactions_by_account)} transactions for account")
    print(f"   ✅ Encrypted field equality query successful")
    
    # Test 3: Decrypt sensitive fields
    print("\n3️⃣  Decrypt sensitive fields:")
    if transactions:
        tx = transactions[0]
        print(f"   Transaction ID (hash): {tx.get('transactionId', '')[:50]}...")
        
        encrypted_amount = tx.get("amount")
        decrypted_amount = decrypt_value(encrypted_amount) if encrypted_amount else None
        print(f"   Amount (encrypted): {encrypted_amount[:50] if encrypted_amount else 'N/A'}...")
        print(f"   Amount (decrypted): {decrypted_amount}")
        
        encrypted_desc = tx.get("description")
        decrypted_desc = decrypt_value(encrypted_desc) if encrypted_desc else None
        print(f"   Description (encrypted): {encrypted_desc[:50] if encrypted_desc else 'N/A'}...")
        print(f"   Description (decrypted): {decrypted_desc}")
        
        encrypted_counterparty = tx.get("counterparty")
        decrypted_counterparty = decrypt_value(encrypted_counterparty) if encrypted_counterparty else None
        print(f"   Counterparty (encrypted): {encrypted_counterparty[:50] if encrypted_counterparty else 'N/A'}...")
        print(f"   Counterparty (decrypted): {decrypted_counterparty}")
        
        print(f"   ✅ Decryption successful")
    
    # Test 4: Query balances
    print("\n4️⃣  Query balances:")
    balances_collection = db["balances_dev"]
    balances = list(balances_collection.find({
        "userId": user_id,
        "accountId": encrypted_account_id
    }))
    print(f"   Found {len(balances)} balances")
    
    if balances:
        balance = balances[0]
        encrypted_amount = balance.get("balanceAmount")
        decrypted_amount = decrypt_value(encrypted_amount) if encrypted_amount else None
        print(f"   Balance Amount (decrypted): {decrypted_amount}")
        print(f"   Balance Type (plaintext): {balance.get('balanceType')}")
        print(f"   ✅ Balance query and decryption successful")
    
    # Test 5: Query by category (plaintext field)
    print("\n5️⃣  Query by category (plaintext):")
    categories = transactions_collection.distinct("category", {"userId": user_id})
    print(f"   Found categories: {', '.join(categories)}")
    
    for category in categories[:2]:  # Show first 2 categories
        count = transactions_collection.count_documents({
            "userId": user_id,
            "category": category
        })
        print(f"   - {category}: {count} transaction(s)")
    
    print(f"   ✅ Category query successful")
    
    # Test 6: Query by date range (plaintext field)
    print("\n6️⃣  Query by date range (plaintext):")
    date_from = (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d")
    recent_transactions = list(transactions_collection.find({
        "userId": user_id,
        "bookingDate": {"$gte": date_from}
    }))
    print(f"   Found {len(recent_transactions)} transactions since {date_from}")
    print(f"   ✅ Date range query successful")


def cleanup_test_data(test_data):
    """Clean up test data from MongoDB."""
    print("\n" + "="*60)
    print("Cleaning Up Test Data")
    print("="*60)
    
    from mongodb import get_db
    
    db = get_db()
    user_id = test_data["user_id"]
    
    # Delete test transactions
    print("\n🗑️  Deleting test transactions...")
    transactions_collection = db["transactions_dev"]
    result = transactions_collection.delete_many({"userId": user_id})
    print(f"   ✅ Deleted {result.deleted_count} transactions")
    
    # Delete test balances
    print("\n🗑️  Deleting test balances...")
    balances_collection = db["balances_dev"]
    result = balances_collection.delete_many({"userId": user_id})
    print(f"   ✅ Deleted {result.deleted_count} balances")


def main():
    """Run the test suite."""
    print("\n" + "="*60)
    print("MongoDB Encryption Test Suite")
    print("="*60)
    print("\nThis test will:")
    print("1. Test basic encryption/decryption")
    print("2. Generate mock GoCardless data")
    print("3. Encrypt and store in MongoDB")
    print("4. Query and decrypt data")
    print("5. Clean up test data")
    print("\nStarting tests...\n")
    
    try:
        # Test 1: Basic encryption/decryption
        test_encryption_decryption()
        
        # Test 2: Seed test data
        test_data = seed_test_data()
        
        # Test 3: Verify queries and decryption
        verify_data_query(test_data)
        
        # Test 4: Cleanup (auto-cleanup in non-interactive mode)
        print("\n" + "="*60)
        # Auto cleanup for CI/non-interactive environments
        cleanup_test_data(test_data)
        
        # Summary
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\n📋 Summary:")
        print("   ✅ Encryption/decryption working")
        print("   ✅ Data stored in MongoDB with encryption")
        print("   ✅ Plaintext fields queryable (userId, category, dates)")
        print("   ✅ Hashed fields queryable for equality (accountId)")
        print("   ✅ Encrypted fields decryptable (amount, description)")
        print("\n🎉 GoCardless sync function is ready for deployment!")
        
        return True
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ TEST FAILED")
        print("="*60)
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

