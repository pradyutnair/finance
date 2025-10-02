import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import {
  buildClient,
  CommitmentPolicy,
  KmsKeyringNode,
} from '@aws-crypto/client-node';

// Type definitions
export interface EncryptedData {
  cipher: string; // base64 ciphertext
  dek_wrapped: string; // base64 KMS-wrapped DEK
  iv: string; // base64 nonce
  tag: string; // base64 auth tag
  enc_version: number;
}

export interface EncryptionConfig {
  provider: 'aws' | 'gcp';
  kmsKeyArn?: string;
  kmsKeyUri?: string;
  encVersion: number;
}

// Error classes
export class EncryptionError extends Error {
  constructor(message: string, public code: string = 'E_ENCRYPTION') {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public code: string = 'E_DECRYPTION') {
    super(message);
    this.name = 'DecryptionError';
  }
}

// Environment validation
function getEncryptionConfig(): EncryptionConfig {
  const provider = (process.env.ENCRYPTION_PROVIDER || 'aws') as 'aws' | 'gcp';
  const encVersion = parseInt(process.env.ENC_VERSION || '1', 10);

  if (provider === 'aws') {
    const kmsKeyArn = process.env.AWS_KMS_KEY_ARN;
    if (!kmsKeyArn) {
      throw new EncryptionError(
        'AWS_KMS_KEY_ARN environment variable is required when ENCRYPTION_PROVIDER is aws',
        'E_CONFIG'
      );
    }
    return { provider: 'aws', kmsKeyArn, encVersion };
  } else if (provider === 'gcp') {
    const kmsKeyUri = process.env.GCP_KMS_KEY_URI;
    if (!kmsKeyUri) {
      throw new EncryptionError(
        'GCP_KMS_KEY_URI environment variable is required when ENCRYPTION_PROVIDER is gcp',
        'E_CONFIG'
      );
    }
    return { provider: 'gcp', kmsKeyUri, encVersion };
  } else {
    throw new EncryptionError(
      `Unsupported ENCRYPTION_PROVIDER: ${provider}. Must be 'aws' or 'gcp'`,
      'E_CONFIG'
    );
  }
}

// AWS Encryption SDK client (lazy initialization)
let awsEncryptClient: ReturnType<typeof buildClient> | null = null;

function getAwsEncryptClient(): ReturnType<typeof buildClient> {
  if (!awsEncryptClient) {
    awsEncryptClient = buildClient(
      CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT
    );
  }
  return awsEncryptClient;
}

/**
 * Encrypt a JSON object using AES-256-GCM with envelope encryption.
 * The DEK is wrapped by AWS KMS (or GCP KMS if provider is gcp).
 * 
 * @param data - The JSON object to encrypt
 * @param aad - Additional authenticated data (e.g., { userId, recordType })
 * @returns Encrypted data structure with cipher, wrapped DEK, iv, tag, and version
 */
export async function encryptJson(
  data: Record<string, any>,
  aad: Record<string, string> = {}
): Promise<EncryptedData> {
  const config = getEncryptionConfig();

  try {
    // Serialize the data to JSON
    const plaintext = JSON.stringify(data);
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');

    if (config.provider === 'aws') {
      // Use AWS Encryption SDK
      const { encrypt } = getAwsEncryptClient();
      const keyring = new KmsKeyringNode({ generatorKeyId: config.kmsKeyArn });

      // Build encryption context (AAD)
      const encryptionContext: Record<string, string> = {
        ...aad,
        enc_version: config.encVersion.toString(),
        timestamp: new Date().toISOString(),
      };

      // Encrypt
      const { result } = await encrypt(keyring, plaintextBuffer, {
        encryptionContext,
      });

      // AWS Encryption SDK returns a message format that includes:
      // - wrapped DEK
      // - IV
      // - ciphertext
      // - auth tag
      // We'll store the entire result as cipher and extract components
      const cipherBase64 = result.toString('base64');

      // For AWS SDK, the entire encrypted message contains all metadata
      // We'll use a simplified structure where cipher contains everything
      return {
        cipher: cipherBase64,
        dek_wrapped: '', // AWS SDK handles this internally
        iv: '', // AWS SDK handles this internally
        tag: '', // AWS SDK handles this internally
        enc_version: config.encVersion,
      };
    } else {
      // GCP implementation would go here
      // For now, throw unsupported
      throw new EncryptionError(
        'GCP KMS provider not yet implemented',
        'E_UNSUPPORTED'
      );
    }
  } catch (error: any) {
    // Clear sensitive data from memory
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      `Encryption failed: ${error.message}`,
      'E_ENCRYPTION'
    );
  }
}

/**
 * Decrypt data encrypted with encryptJson.
 * 
 * @param encData - The encrypted data structure
 * @param aad - Additional authenticated data (must match encryption AAD)
 * @returns The decrypted JSON object
 */
export async function decryptJson(
  encData: EncryptedData,
  aad: Record<string, string> = {}
): Promise<Record<string, any>> {
  const config = getEncryptionConfig();

  try {
    if (config.provider === 'aws') {
      // Use AWS Encryption SDK
      const { decrypt } = getAwsEncryptClient();
      const keyring = new KmsKeyringNode({ keyIds: [config.kmsKeyArn!] });

      // Decode the cipher
      const cipherBuffer = Buffer.from(encData.cipher, 'base64');

      // Build expected encryption context
      const expectedContext: Record<string, string> = {
        ...aad,
        enc_version: encData.enc_version.toString(),
      };

      // Decrypt
      const { plaintext, messageHeader } = await decrypt(keyring, cipherBuffer);

      // Verify encryption context matches (optional but recommended)
      const actualContext = messageHeader.encryptionContext;
      for (const [key, value] of Object.entries(expectedContext)) {
        if (key === 'timestamp') continue; // Skip timestamp check
        if (actualContext[key] !== value) {
          throw new DecryptionError(
            `Encryption context mismatch for key: ${key}`,
            'E_CONTEXT_MISMATCH'
          );
        }
      }

      // Parse JSON
      const plaintextStr = plaintext.toString('utf8');
      const data = JSON.parse(plaintextStr);

      return data;
    } else {
      throw new DecryptionError(
        'GCP KMS provider not yet implemented',
        'E_UNSUPPORTED'
      );
    }
  } catch (error: any) {
    if (error instanceof DecryptionError) {
      throw error;
    }
    throw new DecryptionError(
      `Decryption failed: ${error.message}`,
      'E_DECRYPTION'
    );
  }
}

/**
 * Generate a blind index (HMAC-SHA256) for a sensitive string value.
 * This allows equality searches on encrypted data without revealing the plaintext.
 * 
 * @param value - The plaintext value to index
 * @param keyAlias - The key alias to use ('merchant' or 'desc')
 * @returns Base64url encoded HMAC digest
 */
export function hmacDigest(
  value: string,
  keyAlias: 'merchant' | 'desc'
): string {
  // Get the HMAC key from environment
  const envKey =
    keyAlias === 'merchant'
      ? process.env.INDEX_KEY_MERCHANT
      : process.env.INDEX_KEY_DESC;

  if (!envKey) {
    throw new EncryptionError(
      `Missing environment variable: INDEX_KEY_${keyAlias.toUpperCase()}`,
      'E_CONFIG'
    );
  }

  try {
    // Normalize the value
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '); // Collapse multiple spaces

    // Decode the key (assuming it's base64)
    const keyBuffer = Buffer.from(envKey, 'base64');

    // Compute HMAC-SHA256
    const hmac = createHmac('sha256', keyBuffer);
    hmac.update(normalized, 'utf8');
    const digest = hmac.digest();

    // Return as base64url (URL-safe base64)
    return digest
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error: any) {
    throw new EncryptionError(
      `HMAC generation failed: ${error.message}`,
      'E_HMAC'
    );
  }
}

/**
 * Generate a cryptographically secure random key for HMAC operations.
 * This is a utility function for initial key generation.
 * 
 * @returns Base64 encoded 256-bit random key
 */
export function generateHmacKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Validate encrypted data structure.
 * 
 * @param data - Data to validate
 * @returns true if valid, false otherwise
 */
export function isValidEncryptedData(data: any): data is EncryptedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.cipher === 'string' &&
    typeof data.dek_wrapped === 'string' &&
    typeof data.iv === 'string' &&
    typeof data.tag === 'string' &&
    typeof data.enc_version === 'number'
  );
}

// Export type for better type safety
export type { EncryptedData as EncryptedDataType };
