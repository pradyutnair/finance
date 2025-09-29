import nacl from "tweetnacl";
import { createHmac } from "crypto";

const VERSION = "v1";

function base64ToUint8(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function uint8ToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function encodeUtf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

export type EncryptedPayload = {
  scheme: typeof VERSION;
  nonce: string;
  ephPublicKey: string;
  ciphertext: string;
};

export function encryptForPublicKey(publicKeyBase64: string | null | undefined, plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  if (!publicKeyBase64) {
    throw new Error("Missing recipient public key for encryption");
  }

  const recipientPublicKey = base64ToUint8(publicKeyBase64);
  if (recipientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid recipient public key length");
  }

  const message = encodeUtf8(plaintext);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ephKeyPair = nacl.box.keyPair();

  const ciphertext = nacl.box(message, nonce, recipientPublicKey, ephKeyPair.secretKey);

  const payload: EncryptedPayload = {
    scheme: VERSION,
    nonce: uint8ToBase64(nonce),
    ephPublicKey: uint8ToBase64(ephKeyPair.publicKey),
    ciphertext: uint8ToBase64(ciphertext),
  };

  return JSON.stringify(payload);
}

function normalizeForIndex(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function computeBlindIndex(secret: string | undefined, value: string | null | undefined): string | null {
  if (!value) return null;
  if (!secret) {
    throw new Error("Missing blind index secret");
  }
  const hmac = createHmac("sha256", Buffer.from(secret, "utf-8"));
  hmac.update(normalizeForIndex(value));
  return hmac.digest("base64");
}

 