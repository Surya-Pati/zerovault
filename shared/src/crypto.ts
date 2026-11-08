import { webcrypto } from 'crypto';
import { SigningKey, sha256, randomBytes } from 'ethers';

export interface EncryptResult {
  ciphertext: string; // Base64 encoded ciphertext (including GCM tag)
  iv: string;         // Hex encoded IV (12 bytes / 24 hex characters)
  key: string;        // Hex encoded AES-256 raw key (32 bytes / 64 hex characters)
}

export interface DecryptParams {
  ciphertext: string;
  iv: string;
  key: string;
}

/**
 * Retrieves standard Web Crypto object compatible with Browsers, Node 19+, and test runners.
 */
export function getWebCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto as Crypto;
  }
  if (webcrypto) {
    return webcrypto as unknown as Crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Generates a random 256-bit AES-GCM CryptoKey.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  const cryptoObj = getWebCrypto();
  return await cryptoObj.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to raw hex or base64 format.
 */
export async function exportRawKey(key: CryptoKey, format: 'base64' | 'hex' = 'hex'): Promise<string> {
  const cryptoObj = getWebCrypto();
  const raw = await cryptoObj.subtle.exportKey('raw', key);
  return format === 'hex' ? bufferToHex(raw) : bufferToBase64(raw);
}

/**
 * Imports a raw key (Hex or Base64) into a CryptoKey object for AES-GCM.
 */
export async function importRawKey(rawKeyStr: string): Promise<CryptoKey> {
  const cryptoObj = getWebCrypto();
  const cleaned = rawKeyStr.trim();
  let keyBuffer: ArrayBuffer;

  const isHex = /^(0x)?[0-9a-fA-F]{64}$/.test(cleaned);
  if (isHex) {
    keyBuffer = hexToBuffer(cleaned);
  } else {
    keyBuffer = base64ToBuffer(cleaned);
  }

  return await cryptoObj.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts raw vulnerability report into ciphertext + IV + key using Web Crypto API (AES-256-GCM).
 */
export async function encryptPayload(
  plaintext: string,
  providedKey?: string | CryptoKey
): Promise<EncryptResult> {
  const cryptoObj = getWebCrypto();

  let keyObj: CryptoKey;
  let rawKeyHex: string;

  if (!providedKey) {
    keyObj = await generateAESKey();
    rawKeyHex = await exportRawKey(keyObj, 'hex');
  } else if (typeof providedKey === 'string') {
    const cleanKey = providedKey.startsWith('0x') ? providedKey.slice(2) : providedKey;
    rawKeyHex = cleanKey;
    keyObj = await importRawKey(cleanKey);
  } else {
    keyObj = providedKey;
    rawKeyHex = await exportRawKey(keyObj, 'hex');
  }

  // 12-byte IV for AES-GCM
  const ivArray = new Uint8Array(12);
  cryptoObj.getRandomValues(ivArray);

  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivArray,
    },
    keyObj,
    data
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToHex(ivArray),
    key: rawKeyHex,
  };
}

/**
 * Decrypts ciphertext using raw key + IV with AES-256-GCM.
 */
export async function decryptPayload(params: DecryptParams): Promise<string> {
  const { ciphertext, iv, key } = params;
  const cryptoObj = getWebCrypto();

  const keyObj = await importRawKey(key);

  const cleanIv = iv.trim();
  const isIvHex = /^(0x)?[0-9a-fA-F]{24}$/.test(cleanIv);
  const ivBuffer = isIvHex ? hexToBuffer(cleanIv) : base64ToBuffer(cleanIv);

  const cleanCiphertext = ciphertext.trim();
  const isCiphertextHex = cleanCiphertext.startsWith('0x');
  const ciphertextBuffer = isCiphertextHex
    ? hexToBuffer(cleanCiphertext)
    : base64ToBuffer(cleanCiphertext);

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    keyObj,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypts a raw 32-byte AES key (hex string) for a buyer's secp256k1 public key using ECIES.
 * 
 * Algorithm:
 * 1. Generates ephemeral secp256k1 keypair (e, E).
 * 2. Computes ECDH shared point S = e * P_buyer.
 * 3. Derives 256-bit symmetric key material K_derived = sha256(S).
 * 4. Encrypts rawAesKey using AES-256-GCM with a random 12-byte IV.
 * 5. Returns compact serialized payload:
 *    0x || ephemeralPublicKey (33 bytes) || iv (12 bytes) || ciphertextAndTag (48 bytes)
 *    Total: 93 bytes (186 hex chars + '0x')
 * 
 * @param buyerPublicKeyHex secp256k1 public key (33-byte compressed or 65-byte uncompressed)
 * @param rawAesKeyHex 32-byte AES key in hex
 * @returns 0x-prefixed hex string of the serialized ECIES payload
 */
export async function encryptECIES(buyerPublicKeyHex: string, rawAesKeyHex: string): Promise<string> {
  const cryptoObj = getWebCrypto();
  const cleanPubKey = buyerPublicKeyHex.trim().startsWith('0x')
    ? buyerPublicKeyHex.trim()
    : `0x${buyerPublicKeyHex.trim()}`;

  const cleanAesKey = rawAesKeyHex.trim().startsWith('0x')
    ? rawAesKeyHex.trim().slice(2)
    : rawAesKeyHex.trim();

  if (!/^[0-9a-fA-F]{64}$/.test(cleanAesKey)) {
    throw new Error('Invalid rawAesKeyHex: must be a 32-byte hex string (64 characters)');
  }

  // 1. Ephemeral keypair
  const ephemeralKey = new SigningKey(randomBytes(32));
  const ephemeralPubKeyHex = ephemeralKey.compressedPublicKey; // 33 bytes hex with '0x'

  // 2. ECDH Shared Secret
  const sharedPoint = ephemeralKey.computeSharedSecret(cleanPubKey);
  const derivedKeyHex = sha256(sharedPoint).slice(2);
  const derivedKeyBuffer = hexToBuffer(derivedKeyHex);

  // 3. AES-256-GCM Encryption
  const ivArray = new Uint8Array(12);
  cryptoObj.getRandomValues(ivArray);

  const keyObj = await cryptoObj.subtle.importKey(
    'raw',
    derivedKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const rawKeyData = hexToBuffer(cleanAesKey);
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv: ivArray },
    keyObj,
    rawKeyData
  );

  // 4. Compact Serialization:
  // 33B (ephemeralPubKey) + 12B (iv) + 48B (ciphertext + tag) = 93 bytes
  const serializedHex =
    '0x' +
    ephemeralPubKeyHex.slice(2) +
    bufferToHex(ivArray) +
    bufferToHex(new Uint8Array(ciphertextBuffer));

  return serializedHex;
}

/**
 * Decrypts an ECIES payload using the buyer's secp256k1 private key.
 * 
 * @param buyerPrivateKeyHex 32-byte secp256k1 private key
 * @param serializedPayloadHex 0x-prefixed serialized ECIES hex string (93 bytes)
 * @returns 64-character hex string of the original AES key
 */
export async function decryptECIES(
  buyerPrivateKeyHex: string,
  serializedPayloadHex: string
): Promise<string> {
  const cryptoObj = getWebCrypto();
  const cleanPrivKey = buyerPrivateKeyHex.trim().startsWith('0x')
    ? buyerPrivateKeyHex.trim()
    : `0x${buyerPrivateKeyHex.trim()}`;

  const cleanPayload = serializedPayloadHex.trim().startsWith('0x')
    ? serializedPayloadHex.trim().slice(2)
    : serializedPayloadHex.trim();

  // Payload must be at least 33B (pubkey) + 12B (iv) + 16B (auth tag) = 61 bytes = 122 hex chars
  if (cleanPayload.length < 122 || cleanPayload.length % 2 !== 0) {
    throw new Error('Invalid ECIES payload: invalid length or format');
  }

  const rawBytes = new Uint8Array(hexToBuffer(cleanPayload));

  // 33-byte compressed ephemeral public key
  const ephemeralPubKeyHex = '0x' + bufferToHex(rawBytes.subarray(0, 33));
  const ivBytes = rawBytes.subarray(33, 45);
  const ciphertextBytes = rawBytes.subarray(45);

  // 1. ECDH Shared Secret
  const buyerKey = new SigningKey(cleanPrivKey);
  const sharedPoint = buyerKey.computeSharedSecret(ephemeralPubKeyHex);
  const derivedKeyHex = sha256(sharedPoint).slice(2);
  const derivedKeyBuffer = hexToBuffer(derivedKeyHex);

  // 2. AES-256-GCM Decryption
  const keyObj = await cryptoObj.subtle.importKey(
    'raw',
    derivedKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    keyObj,
    ciphertextBytes
  );

  return bufferToHex(new Uint8Array(decryptedBuffer));
}
