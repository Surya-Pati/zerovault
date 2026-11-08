import {
  createMerkleTree,
  getInclusionProof,
  verifyProof,
  hashLeaf,
  DisclosurePayloadInput,
  MerkleResult,
  InclusionProof,
} from '@zerovault/shared';

export class MerkleService {
  /**
   * Generates a Merkle tree and root for a disclosure payload.
   */
  public static generateTree(payload: DisclosurePayloadInput): MerkleResult {
    return createMerkleTree(payload);
  }

  /**
   * Generates a proof for a specific leaf index.
   */
  public static generateProof(merkleResult: MerkleResult, leafIndex: number): InclusionProof {
    return getInclusionProof(merkleResult, leafIndex);
  }

  /**
   * Verifies a leaf hash and proof against a Merkle root.
   */
  public static verify(root: string, leafHash: string, proof: string[]): boolean {
    return verifyProof(root, leafHash, proof);
  }

  /**
   * Computes the leaf hash for a claim key-value pair with mandatory salt.
   */
  public static hashClaim(key: string, value: string, salt: string): string {
    return hashLeaf(key, value, salt);
  }
}
