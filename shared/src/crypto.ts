import { webcrypto } from 'crypto';

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
