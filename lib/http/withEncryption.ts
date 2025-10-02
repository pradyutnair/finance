import 'server-only';
import { NextResponse } from 'next/server';
import { encryptJson, decryptJson, hmacDigest, EncryptedData, EncryptionError, DecryptionError } from '@/lib/crypto/encryption';
import { Databases, ID } from 'appwrite';
import { randomUUID } from 'crypto';

/**
 * HTTP wrapper for encrypted API routes.
 * Ensures all routes return safe 200 responses with { ok, data?, error? } shape.
 */

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}

export interface ApiSuccess<T = any> {
  ok: true;
  data: T;
  requestId?: string;
}

export interface ApiFailure {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiFailure;

/**
 * Configuration for encryption operations in route handlers.
 */
export interface EncryptionRouteConfig {
  /** Database instance for Appwrite operations */
  databases: Databases;
  /** Database ID */
  databaseId: string;
  /** Public table collection ID (for queryable fields) */
  publicCollectionId?: string;
  /** Encrypted table collection ID (for sensitive fields) */
  encryptedCollectionId: string;
  /** User ID for AAD and authorization */
  userId: string;
  /** Enable blind index generation for specific fields */
  useBlindIndex?: {
    merchant?: boolean;
    description?: boolean;
  };
}

/**
 * Write encrypted data to Appwrite.
 * Stores public fields in public table (optional) and encrypted fields in _enc table.
 * 
 * @param publicData - Public queryable fields
 * @param sensitiveData - Sensitive data to encrypt
 * @param config - Route configuration
 * @param recordId - Optional record ID (if updating existing record)
 * @returns Document IDs for public and encrypted records
 */
export async function writeEncrypted(
  publicData: Record<string, any>,
  sensitiveData: Record<string, any>,
  config: EncryptionRouteConfig,
  recordId?: string
): Promise<{ publicId?: string; encryptedId: string; recordId: string }> {
  const { databases, databaseId, publicCollectionId, encryptedCollectionId, userId, useBlindIndex } = config;

  // Generate record ID if not provided
  const finalRecordId = recordId || randomUUID();

  try {
    // Compute blind indexes if enabled
    const blindIndexes: Record<string, string> = {};
    if (useBlindIndex?.merchant && sensitiveData.counterparty) {
      try {
        blindIndexes.merchant_hmac = hmacDigest(sensitiveData.counterparty, 'merchant');
      } catch (err) {
        console.warn('Failed to generate merchant blind index:', err);
      }
    }
    if (useBlindIndex?.description && sensitiveData.description) {
      try {
        blindIndexes.desc_hmac = hmacDigest(sensitiveData.description, 'desc');
      } catch (err) {
        console.warn('Failed to generate description blind index:', err);
      }
    }

    // Encrypt sensitive data
    const aad = { userId, recordId: finalRecordId, type: encryptedCollectionId };
    const encrypted = await encryptJson(sensitiveData, aad);

    // Write public record (if public collection specified)
    let publicDocId: string | undefined;
    if (publicCollectionId) {
      const publicDoc = {
        ...publicData,
        ...blindIndexes,
        record_id: finalRecordId,
        userId,
      };

      try {
        // Try to create with specific ID if recordId is provided
        const docId = recordId || ID.unique();
        const created = await databases.createDocument(
          databaseId,
          publicCollectionId,
          docId,
          publicDoc
        );
        publicDocId = created.$id;
      } catch (error: any) {
        // Check if it's a duplicate error
        if (error.code === 409 || error.message?.includes('already exists')) {
          // Try to update instead
          if (recordId) {
            const updated = await databases.updateDocument(
              databaseId,
              publicCollectionId,
              recordId,
              publicDoc
            );
            publicDocId = updated.$id;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // Write encrypted record
    const encryptedDoc = {
      record_id: finalRecordId,
      cipher: encrypted.cipher,
      dek_wrapped: encrypted.dek_wrapped,
      iv: encrypted.iv,
      tag: encrypted.tag,
      enc_version: encrypted.enc_version,
      userId, // For user-scoped queries
    };

    let encryptedDocId: string;
    try {
      const created = await databases.createDocument(
        databaseId,
        encryptedCollectionId,
        ID.unique(),
        encryptedDoc
      );
      encryptedDocId = created.$id;
    } catch (error: any) {
      // If public record was created, we should ideally roll it back
      // But Appwrite doesn't support transactions, so we log and continue
      console.error('Failed to create encrypted record after public record:', error);
      throw new Error('Failed to store encrypted data');
    }

    return {
      publicId: publicDocId,
      encryptedId: encryptedDocId,
      recordId: finalRecordId,
    };
  } catch (error: any) {
    if (error instanceof EncryptionError) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Read and decrypt data from Appwrite.
 * Fetches public record and corresponding encrypted record, then merges them.
 * 
 * @param recordId - Record ID to fetch
 * @param config - Route configuration
 * @returns Merged public and decrypted sensitive data
 */
export async function readEncrypted(
  recordId: string,
  config: EncryptionRouteConfig
): Promise<Record<string, any>> {
  const { databases, databaseId, publicCollectionId, encryptedCollectionId, userId } = config;

  try {
    // Fetch public record (if applicable)
    let publicData: Record<string, any> = {};
    if (publicCollectionId) {
      try {
        const publicDoc = await databases.getDocument(
          databaseId,
          publicCollectionId,
          recordId
        );
        publicData = { ...publicDoc };
        // Remove Appwrite metadata from response
        delete publicData.$id;
        delete publicData.$createdAt;
        delete publicData.$updatedAt;
        delete publicData.$permissions;
        delete publicData.$collectionId;
        delete publicData.$databaseId;
      } catch (error: any) {
        // Public record might not exist (e.g., for fully encrypted tables)
        console.warn('Public record not found:', recordId);
      }
    }

    // Fetch encrypted record by record_id
    const encryptedDocs = await databases.listDocuments(
      databaseId,
      encryptedCollectionId,
      [
        // Query.equal doesn't need to be imported, we use the string format
      ]
    );

    // Find the encrypted doc with matching record_id
    const encryptedDoc = encryptedDocs.documents.find(
      (doc: any) => doc.record_id === recordId
    );

    if (!encryptedDoc) {
      throw new Error(`Encrypted record not found for record_id: ${recordId}`);
    }

    // Decrypt sensitive data
    const encrypted: EncryptedData = {
      cipher: encryptedDoc.cipher,
      dek_wrapped: encryptedDoc.dek_wrapped,
      iv: encryptedDoc.iv,
      tag: encryptedDoc.tag,
      enc_version: encryptedDoc.enc_version,
    };

    const aad = { userId, recordId, type: encryptedCollectionId };
    const sensitiveData = await decryptJson(encrypted, aad);

    // Merge public and sensitive data
    return {
      ...publicData,
      ...sensitiveData,
      record_id: recordId,
    };
  } catch (error: any) {
    if (error instanceof DecryptionError) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Higher-order function to wrap route handlers with encryption support.
 * Ensures all errors are caught and returned as safe 200 responses.
 * 
 * @param handler - The route handler function
 * @returns Wrapped handler with error safety
 */
export function withEncryption<T = any>(
  handler: (request: Request, context?: any) => Promise<ApiResponse<T>>
): (request: Request, context?: any) => Promise<NextResponse> {
  return async (request: Request, context?: any): Promise<NextResponse> => {
    const requestId = randomUUID();

    try {
      const result = await handler(request, context);

      if (result.ok) {
        return NextResponse.json({
          ok: true,
          data: result.data,
          requestId,
        });
      } else {
        return NextResponse.json({
          ok: false,
          error: result.error,
          requestId,
        });
      }
    } catch (error: any) {
      // Log error for debugging (but never log sensitive data)
      console.error('[withEncryption] Request failed:', {
        requestId,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });

      // Return safe error response
      const errorCode = error instanceof EncryptionError || error instanceof DecryptionError
        ? error.code
        : 'E_INTERNAL';

      const errorMessage = process.env.NODE_ENV === 'development'
        ? error.message
        : 'An internal error occurred';

      return NextResponse.json({
        ok: false,
        error: {
          code: errorCode,
          message: errorMessage,
          requestId,
        },
      });
    }
  };
}

/**
 * Utility to create a success response.
 */
export function successResponse<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

/**
 * Utility to create an error response.
 */
export function errorResponse(code: string, message: string): ApiFailure {
  return {
    ok: false,
    error: { code, message },
  };
}

/**
 * Batch read encrypted records.
 * Fetches multiple records and decrypts them in parallel.
 * 
 * @param recordIds - Array of record IDs to fetch
 * @param config - Route configuration
 * @returns Array of merged records
 */
export async function readEncryptedBatch(
  recordIds: string[],
  config: EncryptionRouteConfig
): Promise<Record<string, any>[]> {
  const results = await Promise.allSettled(
    recordIds.map((id) => readEncrypted(id, config))
  );

  return results
    .filter((result): result is PromiseFulfilledResult<Record<string, any>> => result.status === 'fulfilled')
    .map((result) => result.value);
}

/**
 * Query public table and decrypt matching records.
 * This is the primary method for querying encrypted data.
 * 
 * @param queries - Appwrite query filters (applied to public table)
 * @param config - Route configuration
 * @returns Array of merged records
 */
export async function queryAndDecrypt(
  queries: string[],
  config: EncryptionRouteConfig
): Promise<Record<string, any>[]> {
  const { databases, databaseId, publicCollectionId, encryptedCollectionId } = config;

  if (!publicCollectionId) {
    throw new Error('Public collection ID is required for querying');
  }

  // Query public table
  const publicDocs = await databases.listDocuments(
    databaseId,
    publicCollectionId,
    queries
  );

  // Extract record IDs
  const recordIds = publicDocs.documents.map((doc: any) => doc.record_id || doc.$id);

  // Fetch and decrypt corresponding encrypted records
  return readEncryptedBatch(recordIds, config);
}
