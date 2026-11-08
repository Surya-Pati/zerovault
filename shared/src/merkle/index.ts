import { MerkleTree } from 'merkletreejs';
import { keccak256, toUtf8Bytes, isHexString, AbiCoder, randomBytes, hexlify } from 'ethers';

export interface DisclosureClaim {
  key: string;
  value: string;
  salt: string; // 0x-prefixed 32-byte hex salt for pre-image dictionary protection (MANDATORY)
}

export interface RawDisclosureClaim {
  key: string;
  value: string;
  salt?: string;
}

export type DisclosurePayloadInput = (DisclosureClaim | RawDisclosureClaim)[] | Record<string, string>;

export interface MerkleResult {
  root: string;           // 0x-prefixed 32-byte hex
  leafHashes: string[];   // 0x-prefixed 32-byte hex per leaf
  leaves: DisclosureClaim[]; // Standardized claim leaves with individual salts
  tree: MerkleTree;       // MerkleTree instance
}

export interface InclusionProof {
  leafIndex: number;
  leafHash: string;
  claim: DisclosureClaim;
  proof: string[];        // 0x-prefixed bytes32 array
}

const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * Pure function to compute keccak256 hash for data (string, hex, or bytes).
 * Returns a Buffer to ensure merkletreejs sorts and hashes pairs identically to OpenZeppelin's MerkleProof.
 */
export function keccak256Hash(data: string | Uint8Array | Buffer): Buffer {
  let hashHex: string;
  if (typeof data === 'string') {
    if (isHexString(data)) {
      hashHex = keccak256(data);
    } else {
      hashHex = keccak256(toUtf8Bytes(data));
    }
  } else {
    hashHex = keccak256(data);
  }
  // Remove '0x' and convert to Buffer
  return Buffer.from(hashHex.slice(2), 'hex');
}

/**
 * Pure function to compute keccak256 hash of a single claim leaf.
 * Uses strict Ethereum ABI encoding: keccak256(abi.encode(key, value, salt)).
 * Enforces mandatory 32-byte (256-bit) salt to prevent dictionary & rainbow table attacks.
 */
export function hashLeaf(key: string, value: string, salt: string): string {
  if (!salt || typeof salt !== 'string') {
    throw new Error('Mandatory salt missing: every disclosure leaf must be salted');
  }
  const formattedSalt = salt.startsWith('0x') ? salt : `0x${salt}`;
  if (!isHexString(formattedSalt, 32)) {
    throw new Error('Invalid salt: must be a 32-byte (256-bit) hex string');
  }
  const encoded = abiCoder.encode(['string', 'string', 'bytes32'], [key, value, formattedSalt]);
  return keccak256(encoded);
}

/**
 * Generates a cryptographically secure 32-byte hex salt for a disclosure claim.
 */
export function generateClaimSalt(): string {
  return hexlify(randomBytes(32));
}

/**
 * Normalizes input payload into an array of DisclosureClaims.
 * Automatically generates cryptographically secure 256-bit salts if not provided.
 */
export function normalizePayload(input: DisclosurePayloadInput): DisclosureClaim[] {
  if (Array.isArray(input)) {
    return input.map((item) => {
      const hasValidSalt = item.salt && typeof item.salt === 'string' && isHexString(item.salt.startsWith('0x') ? item.salt : `0x${item.salt}`, 32);
      return {
        key: item.key.trim(),
        value: item.value.trim(),
        salt: hasValidSalt
          ? (item.salt!.startsWith('0x') ? item.salt! : `0x${item.salt}`)
          : generateClaimSalt(),
      };
    });
  }
  return Object.entries(input).map(([key, value]) => ({
    key: key.trim(),
    value: value.trim(),
    salt: generateClaimSalt(),
  }));
}

/**
 * Pure function to construct a Merkle tree from a seller's disclosure payload.
 * Root output is bytes32 hex string compatible with Solidity / OpenZeppelin MerkleProof.
 */
export function createMerkleTree(payloadInput: DisclosurePayloadInput): MerkleResult {
  const leaves = normalizePayload(payloadInput);
  if (leaves.length === 0) {
    throw new Error('Payload cannot be empty');
  }

  const leafHashes = leaves.map((claim) => hashLeaf(claim.key, claim.value, claim.salt));
  
  // Create MerkleTree with sortPairs: true for OpenZeppelin compatibility
  const tree = new MerkleTree(leafHashes, keccak256Hash, { sortPairs: true });
  const root = tree.getHexRoot();

  return {
    root,
    leafHashes,
    leaves,
    tree,
  };
}

/**
 * Pure function to extract an inclusion proof for a chosen leaf index.
 * Only reveals the specific claim and its corresponding salt — does NOT reveal all salts upfront.
 */
export function getInclusionProof(merkleResult: MerkleResult, leafIndex: number): InclusionProof {
  if (leafIndex < 0 || leafIndex >= merkleResult.leaves.length) {
    throw new Error(`Invalid leafIndex ${leafIndex}. Valid range: 0 to ${merkleResult.leaves.length - 1}`);
  }

  const rawClaim = merkleResult.leaves[leafIndex];
  const leafHash = merkleResult.leafHashes[leafIndex];
  const proof = merkleResult.tree.getHexProof(leafHash);

  return {
    leafIndex,
    leafHash,
    claim: {
      key: rawClaim.key,
      value: rawClaim.value,
      salt: rawClaim.salt,
    },
    proof,
  };
}

/**
 * Pure function to verify a Merkle inclusion proof against a root.
 * Compatible with OpenZeppelin MerkleProof.verify().
 */
export function verifyProof(root: string, leafHash: string, proof: string[]): boolean {
  if (!root || !leafHash || !Array.isArray(proof)) {
    return false;
  }
  return MerkleTree.verify(proof, leafHash, root, keccak256Hash, { sortPairs: true });
}
