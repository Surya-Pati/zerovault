import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther, keccak256, toUtf8Bytes } from 'ethers';

export const DEFAULT_ZEROVAULT_ADDRESS = process.env.NEXT_PUBLIC_ZEROVAULT_ADDRESS || '0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091';
export const DEFAULT_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

export const ZEROVAULT_ABI = [
  "function escrows(bytes32) view returns (bytes32 keyHash, address seller, address vendor, uint256 bountyAmount, uint256 commitTimestamp, uint256 bountyLockedAt, uint8 state)",
  "function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external",
  "function lockBounty(bytes32 merkleRoot) external payable",
  "function revealAndClaim(bytes32 merkleRoot, string calldata decryptionKey) external",
  "function triggerDeadMansSwitch(bytes32 merkleRoot) external",
  "function reclaimBounty(bytes32 merkleRoot) external",
  "function verifyPartialLeaf(bytes32 merkleRoot, bytes32 leaf, bytes32[] calldata proof) public pure returns (bool)",
  "event VulnerabilityCommitted(bytes32 indexed merkleRoot, address indexed seller, address indexed vendor, bytes32 keyHash)",
  "event BountyLocked(bytes32 indexed merkleRoot, uint256 amount)",
  "event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash)",
  "event VaultExpired(bytes32 indexed merkleRoot)",
  "event BountyReclaimed(bytes32 indexed merkleRoot)",
  "event KYCStatusUpdated(address indexed user, bool status)",
  "function isKYCVerified(address) view returns (bool)",
  "function setKYCStatus(address user, bool status) external",
  "function pause() external",
  "function unpause() external",
  "function paused() view returns (bool)",
  "function withdrawRefund() external",
  "function refunds(address) view returns (uint256)",
  "event RefundWithdrawn(address indexed recipient, uint256 amount)"
];

export const EXPECTED_CHAIN_ID = BigInt(
  process.env.NEXT_PUBLIC_CHAIN_ID || 11155111
);

export const EXPECTED_NETWORK_NAME = EXPECTED_CHAIN_ID === BigInt(11155111) ? 'Ethereum Sepolia' : 'Hardhat Localhost (31337)';

/**
 * Validates that the user's connected wallet is on the expected chain ID.
 * Blocks the transaction and logs/throws an error if there is a mismatch.
 */
export async function validateChainId(provider: BrowserProvider): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    const errorMsg = `Wrong Network: Connected to Chain ID ${network.chainId}. Please switch your wallet to ${EXPECTED_NETWORK_NAME} (Chain ID ${EXPECTED_CHAIN_ID}) to continue.`;
    console.error(`[Web3Guard] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

export enum EscrowStateOnChain {
  NONE = 0,
  COMMITTED = 1,
  BOUNTY_LOCKED = 2,
  SETTLED = 3,
  EXPIRED = 4,
  REFUNDED = 5
}

export interface OnChainEscrow {
  keyHash: string;
  seller: string;
  vendor: string;
  bountyAmountEth: string;
  commitTimestamp: number;
  bountyLockedAt: number;
  state: EscrowStateOnChain;
}

export function getReadRpcProvider() {
  return new JsonRpcProvider(DEFAULT_RPC_URL);
}

export async function getWeb3Provider() {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    const provider = new BrowserProvider((window as any).ethereum);
    return provider;
  }
  return null;
}

export async function getZeroVaultContract(contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS, withSigner: boolean = false) {
  if (withSigner) {
    const provider = await getWeb3Provider();
    if (!provider) return null;
    await validateChainId(provider);
    const code = await provider.getCode(contractAddress);
    if (!code || code === '0x' || code === '0x0') {
      throw new Error(`No smart contract found at address ${contractAddress}. Please deploy or synchronize contracts with 'pnpm sync'.`);
    }
    const signer = await provider.getSigner();
    return new Contract(contractAddress, ZEROVAULT_ABI, signer);
  }

  // For read-only calls: first try the user's active browser provider (MetaMask) so state matches user's wallet
  const browserProvider = await getWeb3Provider();
  if (browserProvider) {
    try {
      return new Contract(contractAddress, ZEROVAULT_ABI, browserProvider);
    } catch {}
  }

  // Fallback to direct JsonRpcProvider
  try {
    const rpcProvider = getReadRpcProvider();
    return new Contract(contractAddress, ZEROVAULT_ABI, rpcProvider);
  } catch {
    return null;
  }
}

export async function fetchOnChainEscrow(merkleRoot: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS): Promise<OnChainEscrow | null> {
  try {
    const contract = await getZeroVaultContract(contractAddress, false);
    if (!contract) return null;

    // Check if contract bytecode is deployed at this address to prevent BAD_DATA errors (value="0x")
    const provider = contract.runner?.provider;
    if (provider) {
      try {
        const code = await provider.getCode(contractAddress);
        if (!code || code === '0x' || code === '0x0') {
          return null;
        }
      } catch {
        return null;
      }
    }

    const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
    const result = await contract.escrows(formattedRoot);

    return {
      keyHash: result[0] || result.keyHash,
      seller: result[1] || result.seller,
      vendor: result[2] || result.vendor,
      bountyAmountEth: formatEther(result[3] !== undefined ? result[3] : result.bountyAmount),
      commitTimestamp: Number(result[4] !== undefined ? result[4] : result.commitTimestamp),
      bountyLockedAt: Number(result[5] !== undefined ? result[5] : result.bountyLockedAt),
      state: Number(result[6] !== undefined ? result[6] : result.state) as EscrowStateOnChain,
    };
  } catch (err: any) {
    // Only warn if it's an unexpected error rather than uncommitted or empty bytecode
    if (!err?.message?.includes('could not decode result data') && !err?.message?.includes('BAD_DATA')) {
      console.warn('Failed to fetch on-chain escrow status:', err);
    }
    return null;
  }
}

export async function lockBountyOnChain(merkleRoot: string, amountEth: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
  const tx = await contract.lockBounty(formattedRoot, { value: parseEther(amountEth) });
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (lockBounty).");
  return receipt;
}

export async function revealAndClaimOnChain(merkleRoot: string, decryptionKey: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
  const normalizedKey = normalizeHexKey(decryptionKey);
  const tx = await contract.revealAndClaim(formattedRoot, normalizedKey);
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (revealAndClaim).");
  return receipt;
}

export async function triggerDeadMansSwitchOnChain(merkleRoot: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
  const tx = await contract.triggerDeadMansSwitch(formattedRoot);
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (triggerDeadMansSwitch).");
  return receipt;
}

export async function reclaimBountyOnChain(merkleRoot: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
  const tx = await contract.reclaimBounty(formattedRoot);
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (reclaimBounty).");
  return receipt;
}

export function normalizeHexKey(key: string): string {
  return key.trim().replace(/^0x/i, '').toLowerCase();
}

export function computeKeyHash(key: string): string {
  return keccak256(toUtf8Bytes(normalizeHexKey(key))).toLowerCase();
}

export async function commitVulnerabilityOnChain(merkleRoot: string, keyHash: string, vendorAddress: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const formattedRoot = merkleRoot.startsWith('0x') ? merkleRoot : `0x${merkleRoot}`;
  const formattedKeyHash = keyHash.startsWith('0x') ? keyHash : `0x${keyHash}`;

  const tx = await contract.commitVulnerability(formattedRoot, formattedKeyHash, vendorAddress);
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (commitVulnerability).");
  return receipt;
}

export async function setKYCStatusOnChain(userAddress: string, status: boolean, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const tx = await contract.setKYCStatus(userAddress, status);
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (setKYCStatus).");
  return receipt;
}

export async function pauseContractOnChain(contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const tx = await contract.pause();
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (pause).");
  return receipt;
}

export async function unpauseContractOnChain(contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const tx = await contract.unpause();
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (unpause).");
  return receipt;
}

export async function getContractPausedState(contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS): Promise<boolean> {
  try {
    const contract = await getZeroVaultContract(contractAddress, false);
    if (!contract) return false;
    return await contract.paused();
  } catch {
    return false;
  }
}

export async function getKYCStatus(userAddress: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS): Promise<boolean> {
  try {
    const contract = await getZeroVaultContract(contractAddress, false);
    if (!contract) return false;
    return await contract.isKYCVerified(userAddress);
  } catch {
    return false;
  }
}

export function formatContractError(err: any): string {
  const errStr = (err?.data || err?.message || JSON.stringify(err) || '').toLowerCase();
  
  if (errStr.includes("0xd93c0665") || errStr.includes("enforcedpause")) {
    return "Transaction reverted: ZeroVault is currently PAUSED by the emergency circuit breaker. Transactions cannot be processed until an admin unpauses the contract.";
  }
  if (errStr.includes("0xba505d28") || errStr.includes("kycnotverified")) {
    return "Transaction reverted: Buyer wallet is not verified for KYC on-chain. Please verify KYC in the admin panel.";
  }
  if (errStr.includes("0xe2517d3f") || errStr.includes("accesscontrolunauthorizedaccount")) {
    return "Unauthorized: Your connected MetaMask wallet does not have the required on-chain role for this action.";
  }
  if (errStr.includes("0xbaf3f0f7") || errStr.includes("invalidstate")) {
    return "Transaction reverted: Escrow is not in the required state for this operation.";
  }
  if (errStr.includes("0x82b42900") || errStr.includes("unauthorized")) {
    return "Unauthorized: Only the designated buyer or seller can perform this transaction.";
  }
  if (errStr.includes("0x76d4e1e8") || errStr.includes("invalidkey")) {
    return "Transaction reverted: Submitted decryption key does not match the on-chain key hash.";
  }
  if (errStr.includes("0x9b0056ac") || errStr.includes("timeoutnotreached")) {
    return "Transaction reverted: The required timeout period has not elapsed yet.";
  }
  if (errStr.includes("0x2c5211c6") || errStr.includes("invalidamount")) {
    return "Transaction reverted: Bounty amount must be at least 0.001 ETH.";
  }
  if (errStr.includes("0xed778779") || errStr.includes("escrowalreadyexists")) {
    return "Transaction reverted: An escrow with this Merkle root has already been committed.";
  }
  if (errStr.includes("invalidhash")) {
    return "Transaction reverted: Merkle root or key hash cannot be zero (InvalidHash).";
  }
  if (errStr.includes("bad_data") || errStr.includes("could not decode") || errStr.includes("value=\"0x\"")) {
    return "Contract Error: No contract bytecode found at the configured address. Please ensure the local hardhat node has contracts deployed.";
  }

  return err?.reason || err?.message || "Web3 transaction failed.";
}

export async function getRefundBalance(userAddress: string, contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS): Promise<string> {
  try {
    const contract = await getZeroVaultContract(contractAddress, false);
    if (!contract || !userAddress) return "0";
    const balanceWei = await contract.refunds(userAddress);
    return formatEther(balanceWei);
  } catch {
    return "0";
  }
}

export async function withdrawRefundOnChain(contractAddress: string = DEFAULT_ZEROVAULT_ADDRESS) {
  const contract = await getZeroVaultContract(contractAddress, true);
  if (!contract) throw new Error('Web3 wallet not connected. Please install MetaMask.');

  const tx = await contract.withdrawRefund();
  const receipt = await tx.wait();
  if (receipt && receipt.status === 0) throw new Error("Transaction reverted on-chain (withdrawRefund).");
  return receipt;
}
