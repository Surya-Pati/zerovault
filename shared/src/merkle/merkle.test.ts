import {
  createMerkleTree,
  getInclusionProof,
  verifyProof,
  hashLeaf,
  generateClaimSalt,
  DisclosurePayloadInput,
} from './index';

describe('Module 2 — Cryptographic Hashing & Merkle Tree Library', () => {
  const samplePayload: DisclosurePayloadInput = {
    target: 'Safari 17.4 macOS / iOS',
    cwe: 'CWE-416: Use After Free in WebKit',
    severity: 'Critical (CVSS 9.8)',
    environment: 'macOS Sonoma 14.4 / iOS 17.4',
    pocSummary: 'Heap spray triggering arbitrary code execution in WebKit process',
  };

  describe('Root and Hash Formatting', () => {
    it('generates a valid 0x-prefixed 32-byte hex root and leaf hashes', () => {
      const result = createMerkleTree(samplePayload);

      // Must be 0x followed by 64 hex characters (32 bytes)
      expect(result.root).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(result.leafHashes.length).toBe(5);
      result.leafHashes.forEach((hash) => {
        expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });

    it('generates deterministic output for identical salted input', () => {
      const saltedPayload = [
        { key: 'target', value: 'Safari 17.4 macOS / iOS', salt: '0x1111111111111111111111111111111111111111111111111111111111111111' },
        { key: 'cwe', value: 'CWE-416: Use After Free in WebKit', salt: '0x2222222222222222222222222222222222222222222222222222222222222222' },
      ];
      const tree1 = createMerkleTree(saltedPayload);
      const tree2 = createMerkleTree(saltedPayload);

      expect(tree1.root).toEqual(tree2.root);
      expect(tree1.leafHashes).toEqual(tree2.leafHashes);
    });

    it('computes hashLeaf deterministically', () => {
      const salt = generateClaimSalt();
      const h1 = hashLeaf('cwe', 'CWE-416', salt);
      const h2 = hashLeaf('cwe', 'CWE-416', salt);
      const h3 = hashLeaf('cwe', 'CWE-79', salt);

      expect(h1).toEqual(h2);
      expect(h1).not.toEqual(h3);
    });

    it('prevents delimiter-shift collision attacks using strict ABI encoding', () => {
      // If simple concatenation was used (e.g. key + ":" + value), 
      // these two would incorrectly hash to the exact same leaf: "target:windows:10"
      const salt = generateClaimSalt();
      const collision1 = hashLeaf('target', 'windows:10', salt);
      const collision2 = hashLeaf('target:windows', '10', salt);

      expect(collision1).not.toEqual(collision2);
    });
  });

  describe('Proof Verification', () => {
    it('passes for a valid leaf proof', () => {
      const result = createMerkleTree(samplePayload);

      for (let i = 0; i < result.leaves.length; i++) {
        const inclusionProof = getInclusionProof(result, i);
        const isValid = verifyProof(result.root, inclusionProof.leafHash, inclusionProof.proof);

        expect(isValid).toBe(true);
      }
    });

    it('fails when a leaf hash is tampered with', () => {
      const result = createMerkleTree(samplePayload);
      const inclusionProof = getInclusionProof(result, 1);

      const tamperedLeafHash = hashLeaf('cwe', 'TAMPERED_VALUE_CWE_999', inclusionProof.claim.salt);
      const isValid = verifyProof(result.root, tamperedLeafHash, inclusionProof.proof);

      expect(isValid).toBe(false);
    });

    it('fails when a proof element is tampered with', () => {
      const result = createMerkleTree(samplePayload);
      const inclusionProof = getInclusionProof(result, 0);

      expect(inclusionProof.proof.length).toBeGreaterThan(0);

      const tamperedProof = [...inclusionProof.proof];
      tamperedProof[0] = '0x0000000000000000000000000000000000000000000000000000000000000000';

      const isValid = verifyProof(result.root, inclusionProof.leafHash, tamperedProof);
      expect(isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles a single-leaf tree edge case properly', () => {
      const singleLeafPayload = {
        target: 'Single Vulnerability Target',
      };

      const result = createMerkleTree(singleLeafPayload);
      expect(result.leafHashes.length).toBe(1);
      expect(result.root).toMatch(/^0x[a-fA-F0-9]{64}$/);

      const inclusionProof = getInclusionProof(result, 0);
      expect(inclusionProof.proof).toEqual([]);

      const isValid = verifyProof(result.root, inclusionProof.leafHash, inclusionProof.proof);
      expect(isValid).toBe(true);
    });

    it('throws error when leafIndex is out of bounds', () => {
      const result = createMerkleTree(samplePayload);

      expect(() => getInclusionProof(result, -1)).toThrow();
      expect(() => getInclusionProof(result, 10)).toThrow();
    });

    it('throws error when payload is empty', () => {
      expect(() => createMerkleTree({})).toThrow('Payload cannot be empty');
      expect(() => createMerkleTree([])).toThrow('Payload cannot be empty');
    });
  });

  describe('Payload Confidentiality & Output Scope', () => {
    it('does not leak full plaintext payload in inclusion proof object', () => {
      const result = createMerkleTree(samplePayload);
      const inclusionProof = getInclusionProof(result, 2);

      // Should only reveal the single claim at index 2 (severity) along with its mandatory salt
      expect(inclusionProof.claim.key).toBe('severity');
      expect(inclusionProof.claim.value).toBe('Critical (CVSS 9.8)');
      expect(inclusionProof.claim.salt).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Proof array contains only bytes32 hex hashes
      inclusionProof.proof.forEach((p) => {
        expect(p).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });

      // Verify full samplePayload text does not appear in serialized inclusion proof
      const stringifiedProof = JSON.stringify(inclusionProof);
      expect(stringifiedProof).not.toContain('Safari 17.4 macOS');
      expect(stringifiedProof).not.toContain('CWE-416');
      expect(stringifiedProof).not.toContain('Heap spray');
    });
  });

  describe('Salted Merkle Leaves (LOG-M2-01 Pre-Image Dictionary Protection)', () => {
    it('strictly enforces mandatory salt and rejects unsalted claims', () => {
      // @ts-expect-error Testing runtime rejection when salt is missing
      expect(() => hashLeaf('cwe', 'CWE-416')).toThrow('Mandatory salt missing');
      expect(() => hashLeaf('cwe', 'CWE-416', '')).toThrow('Mandatory salt missing');
    });

    it('rejects invalid salts that are not 32 bytes hex', () => {
      expect(() => hashLeaf('cwe', 'CWE-416', '0x1234')).toThrow('Invalid salt');
      expect(() => hashLeaf('cwe', 'CWE-416', 'not-a-hex-string')).toThrow('Invalid salt');
    });

    it('automatically generates 256-bit salts during createMerkleTree if omitted', () => {
      const tree = createMerkleTree({ target: 'Linux Kernel 6.8', severity: 'CRITICAL' });
      expect(tree.leaves[0].salt).toBeDefined();
      expect(tree.leaves[0].salt).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(tree.leaves[1].salt).toBeDefined();
      expect(tree.leaves[1].salt).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(tree.leaves[0].salt).not.toEqual(tree.leaves[1].salt);
    });

    it('produces different hashes for identical key/value pairs with different salts', () => {
      const salt1 = generateClaimSalt();
      const salt2 = generateClaimSalt();

      const hash1 = hashLeaf('severity', 'CRITICAL', salt1);
      const hash2 = hashLeaf('severity', 'CRITICAL', salt2);

      expect(hash1).not.toEqual(hash2);
    });

    it('verifies proof for salted claims and reveals salt only with proof', () => {
      const saltedPayload = [
        { key: 'cve', value: 'CVE-2026-1234', salt: generateClaimSalt() },
        { key: 'severity', value: 'CRITICAL', salt: generateClaimSalt() },
        { key: 'target', value: 'Linux Kernel 6.8', salt: generateClaimSalt() },
      ];

      const tree = createMerkleTree(saltedPayload);
      const inclusionProof = getInclusionProof(tree, 1);

      expect(inclusionProof.claim.salt).toBeDefined();
      expect(inclusionProof.claim.salt).toEqual(saltedPayload[1].salt);

      // Verify that verifyProof succeeds with the salted leaf hash
      const isValid = verifyProof(tree.root, inclusionProof.leafHash, inclusionProof.proof);
      expect(isValid).toBe(true);

      // Verify re-computing the leaf hash with salt matches leafHash
      const recomputedHash = hashLeaf(
        inclusionProof.claim.key,
        inclusionProof.claim.value,
        inclusionProof.claim.salt
      );
      expect(recomputedHash).toEqual(inclusionProof.leafHash);
    });
  });
});
