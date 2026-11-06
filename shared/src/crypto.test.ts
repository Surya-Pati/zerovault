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
} from './crypto';

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
});
