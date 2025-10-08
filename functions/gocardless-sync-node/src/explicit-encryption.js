/**
 * Explicit Encryption Helpers
 * Manually encrypt before write, auto-decrypt on read
 */

import { Binary } from 'mongodb';
import { getClientEncryption, getDataKeyId } from './mongodb.js';

export async function encryptQueryable(value) {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  const encrypted = await clientEncryption.encrypt(value, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic',
    keyId,
  });
  
  return encrypted;
}

export async function encryptRandom(value) {
  if (value === null || value === undefined || value === '') return null;
  
  const clientEncryption = await getClientEncryption();
  const keyId = await getDataKeyId();
  
  const stringValue = typeof value === 'number' ? String(value) : value;
  
  const encrypted = await clientEncryption.encrypt(stringValue, {
    algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random',
    keyId,
  });
  
  return encrypted;
}

