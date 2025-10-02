#!/usr/bin/env node

/**
 * Generate encryption keys for blind indexes.
 * Run this once during initial setup.
 * 
 * Usage: node scripts/generate-encryption-keys.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Encryption Keys for Blind Indexes\n');
console.log('=' .repeat(60));

// Generate 256-bit keys for HMAC
const merchantKey = crypto.randomBytes(32).toString('base64');
const descKey = crypto.randomBytes(32).toString('base64');

console.log('\nAdd these to your .env file:\n');
console.log(`INDEX_KEY_MERCHANT=${merchantKey}`);
console.log(`INDEX_KEY_DESC=${descKey}`);

console.log('\n' + '='.repeat(60));
console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
console.log('   1. Keep these keys SECRET - never commit to version control');
console.log('   2. Store them in a secure secret manager (AWS Secrets Manager, etc.)');
console.log('   3. Rotate these keys periodically (requires re-indexing data)');
console.log('   4. Different keys for dev/staging/production environments');
console.log('\n');

// Also provide example AWS KMS key ARN format
console.log('📝 AWS KMS Key ARN Format:\n');
console.log('   AWS_KMS_KEY_ARN=arn:aws:kms:<region>:<account-id>:key/<key-id>');
console.log('   Example: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012\n');

// GCP KMS key URI format
console.log('📝 GCP KMS Key URI Format:\n');
console.log('   GCP_KMS_KEY_URI=gcp-kms://projects/<project>/locations/<location>/keyRings/<keyring>/cryptoKeys/<key>');
console.log('   Example: gcp-kms://projects/my-project/locations/us/keyRings/my-keyring/cryptoKeys/my-key\n');

console.log('=' .repeat(60));
console.log('\n✅ Keys generated successfully!\n');
