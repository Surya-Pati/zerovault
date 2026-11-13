/**
 * Unified Cryptographic & Merkle Operations for Frontend.
 * Consumes @zerovault/shared directly to guarantee identical lexicographical
 * sibling-pair sorting (OpenZeppelin MerkleProof compatible) and eliminate cross-package drift.
 */
export {
  hashLeaf,
  verifyProof,
  createMerkleTree,
  getInclusionProof,
  generateClaimSalt,
  normalizePayload,
  keccak256Hash,
  type DisclosureClaim,
  type RawDisclosureClaim,
  type DisclosurePayloadInput,
  type MerkleResult,
  type InclusionProof,
  encryptPayload,
  decryptPayload,
  encryptECIES,
  decryptECIES,
} from '@zerovault/shared';
