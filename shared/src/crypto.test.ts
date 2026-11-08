import {
  encryptPayload,
  decryptPayload,
  generateAESKey,
  exportRawKey,
  importRawKey,
  bufferToHex,
  hexToBuffer,
  bufferToBase64,
  base64ToBuffer,
  encryptECIES,
  decryptECIES,
} from './crypto';
import { Wallet, SigningKey } from 'ethers';

describe('Web Crypto Payload Encryption & Decryption Module (AES-256-GCM)', () => {
  const sampleReport = JSON.stringify({
    title: 'Critical Zero-Day Remote Code Execution in ZeroVault Kernel',
    cve: 'CVE-2026-9999',
    severity: 'CRITICAL',
    description: 'Stack buffer overflow in packet parser allows unauthenticated remote code execution.',
    exploitPoC: 'curl -X POST http://target/vulnerable -d "payload=0xDEADBEEF..."',
  });

  test('should encrypt raw vulnerability report into ciphertext, IV, and key', async () => {
    const result = await encryptPayload(sampleReport);

    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('key');

    expect(typeof result.ciphertext).toBe('string');
    expect(result.ciphertext.length).toBeGreaterThan(0);

    // IV should be 12 bytes = 24 hex characters
    expect(result.iv).toMatch(/^[0-9a-fA-F]{24}$/);

    // Key should be 32 bytes = 64 hex characters
    expect(result.key).toMatch(/^[0-9a-fA-F]{64}$/);
  });

  test('should decrypt ciphertext using raw key + IV to restore original report', async () => {
    const encrypted = await encryptPayload(sampleReport);

    const decrypted = await decryptPayload({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      key: encrypted.key,
    });

    expect(decrypted).toBe(sampleReport);

    const parsedReport = JSON.parse(decrypted);
    expect(parsedReport.cve).toBe('CVE-2026-9999');
    expect(parsedReport.severity).toBe('CRITICAL');
  });

  test('should support encrypting with a custom pre-generated key string', async () => {
    const customKey = await generateAESKey();
    const customKeyHex = await exportRawKey(customKey, 'hex');

    const encrypted = await encryptPayload(sampleReport, customKeyHex);
    expect(encrypted.key.toLowerCase()).toBe(customKeyHex.toLowerCase());

    const decrypted = await decryptPayload({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      key: customKeyHex,
    });

    expect(decrypted).toBe(sampleReport);
  });

  test('should fail decryption if key is invalid/incorrect', async () => {
    const encrypted = await encryptPayload(sampleReport);
    const wrongKey = '0'.repeat(64);

    await expect(
      decryptPayload({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        key: wrongKey,
      })
    ).rejects.toThrow();
  });

  test('should fail decryption if ciphertext is tampered (GCM auth tag check)', async () => {
    const encrypted = await encryptPayload(sampleReport);

    // Tamper with base64 ciphertext
    const tamperedCiphertext =
      encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 4) + 'AAAA';

    await expect(
      decryptPayload({
        ciphertext: tamperedCiphertext,
        iv: encrypted.iv,
        key: encrypted.key,
      })
    ).rejects.toThrow();
  });

  test('should convert between ArrayBuffer, Hex, and Base64 accurately', () => {
    const sampleBytes = new Uint8Array([0x00, 0x12, 0xab, 0xcd, 0xef, 0xff]);
    const hex = bufferToHex(sampleBytes);
    expect(hex).toBe('0012abcdefff');

    const backBuffer = hexToBuffer(hex);
    expect(new Uint8Array(backBuffer)).toEqual(sampleBytes);

    const base64 = bufferToBase64(sampleBytes);
    const fromBase64 = base64ToBuffer(base64);
    expect(new Uint8Array(fromBase64)).toEqual(sampleBytes);
  });

  describe('ECIES Asymmetric Key Exchange (secp256k1 + AES-256-GCM)', () => {
    test('encrypts and decrypts AES key using secp256k1 keypair', async () => {
      const buyer = Wallet.createRandom();
      const rawAesKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = await encryptECIES(buyer.publicKey, rawAesKey);
      expect(encrypted).toMatch(/^0x[0-9a-fA-F]{186}$/); // 93 bytes hex (186 hex chars)

      const decrypted = await decryptECIES(buyer.privateKey, encrypted);
      expect(decrypted.toLowerCase()).toBe(rawAesKey.toLowerCase());
    });

    test('supports uncompressed (65-byte) and compressed (33-byte) public keys', async () => {
      const buyer = Wallet.createRandom();
      const signingKey = new SigningKey(buyer.privateKey);
      const rawAesKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

      // Compressed (33B / 66 chars)
      const enc1 = await encryptECIES(signingKey.compressedPublicKey, rawAesKey);
      const dec1 = await decryptECIES(buyer.privateKey, enc1);
      expect(dec1.toLowerCase()).toBe(rawAesKey.toLowerCase());

      // Uncompressed (65B / 130 chars)
      const enc2 = await encryptECIES(signingKey.publicKey, rawAesKey);
      const dec2 = await decryptECIES(buyer.privateKey, enc2);
      expect(dec2.toLowerCase()).toBe(rawAesKey.toLowerCase());
    });

    test('fails decryption when wrong private key is provided', async () => {
      const buyer = Wallet.createRandom();
      const attacker = Wallet.createRandom();
      const rawAesKey = '1111111111111111111111111111111111111111111111111111111111111111';

      const encrypted = await encryptECIES(buyer.publicKey, rawAesKey);
      await expect(decryptECIES(attacker.privateKey, encrypted)).rejects.toThrow();
    });

    test('fails decryption if encrypted payload is tampered', async () => {
      const buyer = Wallet.createRandom();
      const rawAesKey = '2222222222222222222222222222222222222222222222222222222222222222';

      const encrypted = await encryptECIES(buyer.publicKey, rawAesKey);
      // Tamper last byte
      const tampered = encrypted.slice(0, -2) + 'ff';
      await expect(decryptECIES(buyer.privateKey, tampered)).rejects.toThrow();
    });

    test('rejects invalid or truncated payload inputs', async () => {
      const buyer = Wallet.createRandom();
      await expect(decryptECIES(buyer.privateKey, '0x1234')).rejects.toThrow('Invalid ECIES payload');
      await expect(decryptECIES(buyer.privateKey, 'not-hex')).rejects.toThrow('Invalid ECIES payload');
    });

    test('rejects invalid rawAesKey that is not 32 bytes hex', async () => {
      const buyer = Wallet.createRandom();
      await expect(encryptECIES(buyer.publicKey, '1234')).rejects.toThrow('Invalid rawAesKeyHex');
    });
  });
});
