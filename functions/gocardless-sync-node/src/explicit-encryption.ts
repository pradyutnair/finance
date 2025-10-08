/**
 * Explicit Encryption Helpers
 * Manually encrypt before write, auto-decrypt on read
 */

import { Binary } from 'mongodb';
import { getClientEncryption, getDataKeyId } from './mongodb';

export async function encryptQueryable(value: string | null | undefined): Promise<Binary | null> {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  const encrypted = await clientEncryption.encrypt(value, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
    keyId,
  } as any);
  
  return encrypted;
}

export async function encryptRandom(value: string | number | null | undefined): Promise<Binary | null> {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  const stringValue = typeof value === 'number' ? String(value) : value;
  
  const encrypted = await clientEncryption.encrypt(stringValue, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random',
    keyId,
  } as any);
  
  return encrypted;
}

