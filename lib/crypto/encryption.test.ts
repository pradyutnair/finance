/**
 * Encryption module tests
 * 
 * Run with: npm test (after setting up Jest)
 * 
 * Note: These tests require environment variables to be set:
 * - ENCRYPTION_PROVIDER=aws
 * - AWS_KMS_KEY_ARN=...
 * - AWS credentials
 * - INDEX_KEY_MERCHANT=...
 * - INDEX_KEY_DESC=...
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { encryptJson, decryptJson, hmacDigest, generateHmacKey, isValidEncryptedData } from './encryption';

describe('Encryption Module', () => {
  // Skip tests if encryption is not configured
  const isConfigured = process.env.AWS_KMS_KEY_ARN && process.env.INDEX_KEY_MERCHANT;

  beforeAll(() => {
    if (!isConfigured) {
      console.warn('⚠️  Encryption tests skipped: AWS_KMS_KEY_ARN not configured');
    }
  });

  describe('encryptJson and decryptJson', () => {
    test('should encrypt and decrypt data successfully', async () => {
      if (!isConfigured) return;

      const testData = {
        description: 'Test transaction',
        counterparty: 'Test Merchant',
        amount: '100.50',
      };

      const aad = {
        userId: 'test-user-123',
        recordId: 'test-record-456',
      };

      // Encrypt
      const encrypted = await encryptJson(testData, aad);

      // Verify encrypted structure
      expect(encrypted).toHaveProperty('cipher');
      expect(encrypted).toHaveProperty('dek_wrapped');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('enc_version');
      expect(encrypted.enc_version).toBe(1);

      // Decrypt
      const decrypted = await decryptJson(encrypted, aad);

      // Verify data matches
      expect(decrypted).toEqual(testData);
    });

    test('should fail decryption with wrong AAD', async () => {
      if (!isConfigured) return;

      const testData = { secret: 'data' };
      const aad1 = { userId: 'user1' };
      const aad2 = { userId: 'user2' }; // Different AAD

      const encrypted = await encryptJson(testData, aad1);

      // Attempting to decrypt with different AAD should fail
      await expect(decryptJson(encrypted, aad2)).rejects.toThrow();
    });

    test('should handle complex nested objects', async () => {
      if (!isConfigured) return;

      const testData = {
        transaction: {
          id: 'txn-123',
          details: {
            merchant: 'Amazon',
            items: ['Item 1', 'Item 2'],
            metadata: { source: 'api', version: 2 },
          },
        },
        timestamp: new Date().toISOString(),
      };

      const aad = { userId: 'user-789' };

      const encrypted = await encryptJson(testData, aad);
      const decrypted = await decryptJson(encrypted, aad);

      expect(decrypted).toEqual(testData);
    });

    test('should handle empty objects', async () => {
      if (!isConfigured) return;

      const testData = {};
      const aad = { userId: 'user-empty' };

      const encrypted = await encryptJson(testData, aad);
      const decrypted = await decryptJson(encrypted, aad);

      expect(decrypted).toEqual(testData);
    });
  });

  describe('hmacDigest', () => {
    test('should generate consistent HMAC for same input', () => {
      if (!process.env.INDEX_KEY_MERCHANT) return;

      const input = 'Amazon';
      const hmac1 = hmacDigest(input, 'merchant');
      const hmac2 = hmacDigest(input, 'merchant');

      expect(hmac1).toBe(hmac2);
      expect(typeof hmac1).toBe('string');
      expect(hmac1.length).toBeGreaterThan(0);
    });

    test('should normalize input (case-insensitive, whitespace)', () => {
      if (!process.env.INDEX_KEY_MERCHANT) return;

      const hmac1 = hmacDigest('Amazon', 'merchant');
      const hmac2 = hmacDigest('amazon', 'merchant');
      const hmac3 = hmacDigest('  AMAZON  ', 'merchant');
      const hmac4 = hmacDigest('A M A Z O N', 'merchant');

      expect(hmac1).toBe(hmac2);
      expect(hmac1).toBe(hmac3);
      expect(hmac1).not.toBe(hmac4); // Extra spaces not collapsed by normalize
    });

    test('should generate different HMACs for different inputs', () => {
      if (!process.env.INDEX_KEY_MERCHANT) return;

      const hmac1 = hmacDigest('Amazon', 'merchant');
      const hmac2 = hmacDigest('Google', 'merchant');

      expect(hmac1).not.toBe(hmac2);
    });

    test('should generate different HMACs for different key aliases', () => {
      if (!process.env.INDEX_KEY_MERCHANT || !process.env.INDEX_KEY_DESC) return;

      const input = 'Test String';
      const hmac1 = hmacDigest(input, 'merchant');
      const hmac2 = hmacDigest(input, 'desc');

      expect(hmac1).not.toBe(hmac2);
    });

    test('should return base64url encoded string', () => {
      if (!process.env.INDEX_KEY_MERCHANT) return;

      const hmac = hmacDigest('Test', 'merchant');

      // Base64url should not contain +, /, or =
      expect(hmac).not.toContain('+');
      expect(hmac).not.toContain('/');
      expect(hmac).not.toContain('=');
    });
  });

  describe('generateHmacKey', () => {
    test('should generate a valid base64 key', () => {
      const key = generateHmacKey();

      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);

      // Should be valid base64
      const buffer = Buffer.from(key, 'base64');
      expect(buffer.length).toBe(32); // 256 bits
    });

    test('should generate unique keys', () => {
      const key1 = generateHmacKey();
      const key2 = generateHmacKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidEncryptedData', () => {
    test('should validate correct encrypted data structure', () => {
      const validData = {
        cipher: 'base64string',
        dek_wrapped: 'base64string',
        iv: 'base64string',
        tag: 'base64string',
        enc_version: 1,
      };

      expect(isValidEncryptedData(validData)).toBe(true);
    });

    test('should reject invalid structures', () => {
      const invalid1 = { cipher: 'test' }; // Missing fields
      const invalid2 = { ...{ cipher: 'test', dek_wrapped: 'test', iv: 'test', tag: 'test', enc_version: 'not-a-number' } };
      const invalid3 = null;
      const invalid4 = 'string';

      expect(isValidEncryptedData(invalid1)).toBe(false);
      expect(isValidEncryptedData(invalid2)).toBe(false);
      expect(isValidEncryptedData(invalid3)).toBe(false);
      expect(isValidEncryptedData(invalid4)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should throw EncryptionError for invalid input', async () => {
      if (!isConfigured) return;

      // Cannot encrypt circular references
      const circular: any = { a: 1 };
      circular.self = circular;

      await expect(encryptJson(circular, {})).rejects.toThrow();
    });

    test('should throw DecryptionError for invalid ciphertext', async () => {
      if (!isConfigured) return;

      const invalidEncrypted = {
        cipher: 'invalid-base64-!@#$',
        dek_wrapped: '',
        iv: '',
        tag: '',
        enc_version: 1,
      };

      await expect(decryptJson(invalidEncrypted, {})).rejects.toThrow();
    });
  });
});

// Performance benchmark (optional)
describe('Performance Benchmarks', () => {
  const isConfigured = process.env.AWS_KMS_KEY_ARN;

  test('should encrypt 100 records in reasonable time', async () => {
    if (!isConfigured) return;

    const testData = {
      description: 'Test transaction',
      counterparty: 'Test Merchant',
    };

    const start = Date.now();

    const promises = Array.from({ length: 100 }, (_, i) =>
      encryptJson(testData, { userId: `user-${i}` })
    );

    await Promise.all(promises);

    const duration = Date.now() - start;
    console.log(`Encrypted 100 records in ${duration}ms (${duration / 100}ms per record)`);

    // Should complete in under 10 seconds (100ms per record)
    expect(duration).toBeLessThan(10000);
  }, 15000); // 15 second timeout

  test('should compute 1000 HMACs in reasonable time', () => {
    if (!process.env.INDEX_KEY_MERCHANT) return;

    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      hmacDigest(`Merchant ${i}`, 'merchant');
    }

    const duration = Date.now() - start;
    console.log(`Computed 1000 HMACs in ${duration}ms (${duration / 1000}ms per HMAC)`);

    // Should be very fast (< 100ms total)
    expect(duration).toBeLessThan(100);
  });
});
