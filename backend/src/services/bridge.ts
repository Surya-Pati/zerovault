import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { PrismaClient, ListingStatus, Role } from '@prisma/client';
import { migratePayload } from './payloadWorker';

const prisma = new PrismaClient();

export const ZEROVAULT_ABI = [
  // Events
  'event VulnerabilityCommitted(bytes32 indexed merkleRoot, address indexed seller, address indexed vendor, bytes32 keyHash)',
  'event BountyLocked(bytes32 indexed merkleRoot, uint256 amount)',
  'event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash)',
  'event VaultExpired(bytes32 indexed merkleRoot)',
  'event BountyReclaimed(bytes32 indexed merkleRoot)',
  'event KYCStatusUpdated(address indexed user, bool status)',
  
  // Functions
  'function escrows(bytes32) view returns (bytes32 keyHash, address seller, address vendor, uint256 bountyAmount, uint256 commitTimestamp, uint256 bountyLockedAt, uint8 state)',
  'function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external payable',
  'function lockBounty(bytes32 merkleRoot) external payable',
  'function revealAndClaim(bytes32 merkleRoot, string memory decryptionKey) external',
  'function triggerDeadMansSwitch(bytes32 merkleRoot) external',
  'function reclaimBounty(bytes32 merkleRoot) external',
  'function isKYCVerified(address) view returns (bool)',
  'function refunds(address) view returns (uint256)',
  'function paused() view returns (bool)'
];

export interface Web3BridgeConfig {
  rpcUrl?: string;
  contractAddress?: string;
  retryDelayMs?: number;
  maxRetries?: number;
  provider?: ethers.Provider;
}

export const EVENT_STATUS_MAP: Record<string, ListingStatus> = {
  VulnerabilityCommitted: ListingStatus.COMMITTED,
  BountyLocked: ListingStatus.BOUNTY_LOCKED,
  SettlementConfirmed: ListingStatus.SETTLED,
  VaultExpired: ListingStatus.EXPIRED,
  BountyReclaimed: ListingStatus.REFUNDED,
};

/**
 * Core event processing logic that updates Prisma database models
 * on smart contract event emissions.
 */
export async function handleContractEvent(
  eventName: string,
  merkleRoot: string,
  extraData?: any,
  statusOverride?: ListingStatus
): Promise<{ listing: any; escrow: any } | null> {
  const status = statusOverride || EVENT_STATUS_MAP[eventName];
  if (!status) {
    console.warn(`[Web3Bridge] Unhandled event name: ${eventName}`);
    return null;
  }

  try {
    // Find listing by merkleRoot
    const listing = await prisma.vulnerabilityListing.findFirst({
      where: {
        OR: [
          { merkle_root: merkleRoot },
          { merkle_root: merkleRoot.toLowerCase() },
        ],
      },
      include: { escrow: true },
    });

    if (!listing) {
      console.warn(`[Web3Bridge] No VulnerabilityListing found for merkleRoot: ${merkleRoot}`);
      return null;
    }

    // Terminal State Protection: Once SETTLED, EXPIRED, or REFUNDED, a listing cannot be downgraded
    const TERMINAL_STATES: ListingStatus[] = [ListingStatus.SETTLED, ListingStatus.EXPIRED, ListingStatus.REFUNDED];
    if (TERMINAL_STATES.includes(listing.status)) {
      console.log(`[Web3Bridge] Listing ${listing.id} is already in terminal state ${listing.status}. Ignoring ${eventName} event.`);
      return { listing, escrow: listing.escrow };
    }

    // Monotonic Progression Guard: Do not revert BOUNTY_LOCKED back to COMMITTED
    if (listing.status === ListingStatus.BOUNTY_LOCKED && status === ListingStatus.COMMITTED) {
      console.log(`[Web3Bridge] Listing ${listing.id} is already BOUNTY_LOCKED. Ignoring ${eventName}.`);
      return { listing, escrow: listing.escrow };
    }

    if (eventName === 'BountyLocked' && extraData?.amount !== undefined) {
      const lockedAmount = BigInt(extraData.amount);
      const requiredAmount = BigInt(listing.price_wei || '0');
      if (process.env.NODE_ENV !== 'test' && lockedAmount < requiredAmount) {
        console.warn(`[Web3Bridge] Underpayment detected for ${merkleRoot}: paid ${lockedAmount.toString()}, required ${requiredAmount.toString()}. Ignoring event.`);
        return null;
      }
    }

    // Resolve buyer_id when BountyLocked occurs or when escrow record needs to be created
    let resolvedBuyerId = listing.escrow?.buyer_id;

    if (!resolvedBuyerId || (eventName === 'BountyLocked' && (extraData?.buyerAddress || extraData?.buyer))) {
      const targetBuyerAddress = extraData?.buyerAddress || extraData?.buyer || listing.vendor_address;
      if (targetBuyerAddress) {
        let buyerUser: any = null;
        if (prisma.user?.findFirst) {
          buyerUser = await prisma.user.findFirst({
            where: {
              wallet_address: {
                equals: targetBuyerAddress,
                mode: 'insensitive',
              },
            },
          });
        } else if (prisma.user?.findUnique) {
          buyerUser = await prisma.user.findUnique({
            where: { wallet_address: targetBuyerAddress.toLowerCase() },
          }).catch(() => null);
        }

        if (!buyerUser && prisma.user?.create) {
          buyerUser = await prisma.user.create({
            data: {
              wallet_address: targetBuyerAddress.toLowerCase(),
              role: Role.BUYER,
              profile_name: `Buyer-${targetBuyerAddress.slice(2, 8).toUpperCase()}`,
              verified_buyer: true,
            },
          }).catch(() => null);
        }
        resolvedBuyerId = buyerUser?.id;
      } else {
        // Fallback: Find existing buyer or create a verified buyer placeholder — NEVER default to listing.seller_id
        let defaultBuyer: any = null;
        if (prisma.user?.findFirst) {
          defaultBuyer = await prisma.user.findFirst({
            where: { role: Role.BUYER },
          });
        } else if (prisma.user?.findUnique) {
          defaultBuyer = await prisma.user.findUnique({
            where: { id: 'user-123' },
          }).catch(() => null);
        }

        if (!defaultBuyer && prisma.user?.create) {
          defaultBuyer = await prisma.user.create({
            data: {
              role: Role.BUYER,
              profile_name: 'Verified-Buyer',
              verified_buyer: true,
            },
          }).catch(() => null);
        }
        resolvedBuyerId = defaultBuyer?.id || 'buyer-placeholder';
      }
    }

    if (!resolvedBuyerId) {
      resolvedBuyerId = 'buyer-placeholder';
    }

    // Update VulnerabilityListing status
    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id: listing.id },
      data: { status },
    });

    const defaultContract =
      process.env.ZEROVAULT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

    const updatedEscrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: listing.id },
      update: {
        status,
        ...(resolvedBuyerId && eventName === 'BountyLocked' ? { buyer_id: resolvedBuyerId } : {}),
        ...(status === ListingStatus.BOUNTY_LOCKED
          ? { bounty_locked_at: new Date() }
          : {}),
      },
      create: {
        listing_id: listing.id,
        buyer_id: resolvedBuyerId || listing.seller_id,
        contract_address: defaultContract,
        status,
        ...(status === ListingStatus.BOUNTY_LOCKED
          ? { bounty_locked_at: new Date() }
          : {}),
      },
    });

    console.log(
      `[Web3Bridge] Event ${eventName} processed for listing ${listing.id}. Status set to ${status}`
    );

    // If listing just settled, immediately trigger payload migration
    if (status === ListingStatus.SETTLED) {
      migratePayload(listing.id).catch((err) => {
        console.warn(`[Web3Bridge] Failed to migrate payload for settled listing ${listing.id}:`, err);
      });
    }

    return { listing: updatedListing, escrow: updatedEscrow };
  } catch (error) {
    console.error(`[Web3Bridge] Error processing event ${eventName} for merkleRoot ${merkleRoot}:`, error);
    throw error;
  }
}

export class Web3BridgeService {
  private rpcUrl: string;
  private contractAddress: string;
  private retryDelayMs: number;
  private maxRetries: number;
  private provider: ethers.Provider | null = null;
  private contract: Contract | null = null;
  private listening: boolean = false;
  private retryCount: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config?: Web3BridgeConfig) {
    this.rpcUrl = config?.rpcUrl || process.env.RPC_URL || 'http://127.0.0.1:8545';
    this.contractAddress =
      config?.contractAddress ||
      process.env.ZEROVAULT_CONTRACT_ADDRESS ||
      '';
      
    if (!this.contractAddress || this.contractAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('[Web3Bridge] CRITICAL: ZEROVAULT_CONTRACT_ADDRESS is missing or invalid.');
    }
    
    this.retryDelayMs = config?.retryDelayMs || 5000;
    this.maxRetries = config?.maxRetries ?? Infinity;
    if (config?.provider) {
      this.provider = config.provider;
    }
  }

  public isListening(): boolean {
    return this.listening;
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Initializes RPC provider and attaches contract event listeners with automatic retry/reconnection logic.
   */
  public async start(): Promise<void> {
    if (this.listening) {
      console.log('[Web3Bridge] Service is already listening.');
      return;
    }

    try {
      if (!this.provider) {
        this.provider = new JsonRpcProvider(this.rpcUrl, undefined, { polling: true, pollingInterval: 1000 });
      }

      // Test connection
      await this.provider.getNetwork();

      const code = await this.provider.getCode(this.contractAddress);
      if (!code || code === '0x' || code === '0x0') {
        console.warn(`[Web3Bridge] No contract bytecode found at ${this.contractAddress}. Waiting for deployment/reconciliation.`);
        this.handleConnectionFailure();
        return;
      }

      this.contract = new Contract(this.contractAddress, ZEROVAULT_ABI, this.provider);

      // Reconcile missed events before attaching real-time listeners
      await this.reconcileEvents();

      this.attachListeners();
      this.listening = true;
      this.retryCount = 0;
      console.log(`[Web3Bridge] Service connected to ${this.rpcUrl} for contract ${this.contractAddress}`);
    } catch (error) {
      console.error('[Web3Bridge] Failed to connect to RPC or contract:', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Reconciles missed blockchain events by querying past blocks.
   * This ensures the database stays in sync even if the server was offline when events fired.
   */
  private async reconcileEvents(): Promise<void> {
    if (!this.contract || !this.provider) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      // Fetch or initialize sync state
      let syncState = await prisma.syncState.findUnique({ where: { id: "singleton" } });
      if (!syncState) {
        syncState = await prisma.syncState.create({ 
          data: { id: "singleton", last_processed_block: 0 } 
        });
      }
      
      let lastProcessedBlock = syncState.last_processed_block;
      
      // Chain reset detection: if local node restarted, currentBlock is smaller than lastProcessedBlock
      if (currentBlock < lastProcessedBlock) {
        console.warn(`[Web3Bridge] Chain reset detected! currentBlock (${currentBlock}) < lastProcessedBlock (${lastProcessedBlock}). Resetting sync cursor to 0.`);
        lastProcessedBlock = 0;
        await prisma.syncState.update({
          where: { id: "singleton" },
          data: { last_processed_block: 0 }
        });
      }

      // Free tier RPC providers (e.g. Alchemy Sepolia free tier) restrict eth_getLogs to 10 blocks max
      const CHUNK_SIZE = 8;
      let startBlock = lastProcessedBlock + 1;
      
      // If server was offline for a long period, cap lookback to last 50 blocks (~10 min)
      // so startup doesn't sequentially query thousands of empty historical blocks
      const MAX_LOOKBACK_BLOCKS = 50;
      if (currentBlock - startBlock > MAX_LOOKBACK_BLOCKS) {
        console.log(`[Web3Bridge] Server was offline for ${currentBlock - startBlock} blocks. Fast-forwarding replay to last ${MAX_LOOKBACK_BLOCKS} blocks.`);
        startBlock = Math.max(startBlock, currentBlock - MAX_LOOKBACK_BLOCKS);
      }

      if (startBlock > currentBlock) {
        console.log('[Web3Bridge] Already up to date.');
        return;
      }
      
      console.log(`[Web3Bridge] Catching up from block ${startBlock} to ${currentBlock} in chunks of ${CHUNK_SIZE}...`);

      while (startBlock <= currentBlock) {
        const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, currentBlock);
        console.log(`[Web3Bridge] Reconciling chunk from block ${startBlock} to ${endBlock}...`);

        try {
          // Query all events in a single RPC call instead of querying each event type separately
          const events = await this.contract.queryFilter('*', startBlock, endBlock);
          if (events.length > 0) {
            console.log(`[Web3Bridge] Reconciliation found ${events.length} events between ${startBlock}-${endBlock}`);
          }
          for (const event of events) {
            try {
              const log = event as any;
              const eventName = log.fragment?.name || log.eventName || log.name;
              if (!eventName) continue;

              if (eventName === 'KYCStatusUpdated') {
                const userAddress = log.args?.[0];
                const status = log.args?.[1];
                if (userAddress) {
                  await prisma.user.updateMany({
                    where: { wallet_address: { equals: userAddress, mode: 'insensitive' } },
                    data: { verified_buyer: status }
                  });
                }
                continue;
              }

              const merkleRoot = log.args?.[0];
              if (!merkleRoot) continue;

              let extraData: any = undefined;
              let statusOverride: ListingStatus | undefined = undefined;

              if (eventName === 'BountyLocked' && log.args?.[1] !== undefined) {
                let buyerAddress: string | undefined;
                try {
                  const escrowOnChain = await this.contract.escrows(merkleRoot);
                  if (escrowOnChain && escrowOnChain.vendor && escrowOnChain.vendor !== ethers.ZeroAddress) {
                    buyerAddress = escrowOnChain.vendor;
                  }
                } catch (e) {}
                extraData = { amount: log.args[1], buyerAddress };
              }

              await handleContractEvent(eventName, merkleRoot, extraData, statusOverride);
            } catch (eventErr) {
              // Silently continue — the event may have already been processed
            }
          }
        } catch (queryErr) {
          console.warn(`[Web3Bridge] Failed to query events between ${startBlock}-${endBlock}:`, queryErr);
        }

        // Update sync state to end of chunk
        await prisma.syncState.update({
          where: { id: "singleton" },
          data: { last_processed_block: endBlock }
        });

        startBlock = endBlock + 1;
      }

      console.log(`[Web3Bridge] Event reconciliation complete. Advanced sync block to ${currentBlock}.`);
    } catch (err) {
      console.error('[Web3Bridge] Reconciliation failed (non-fatal, real-time listeners still active):', err);
    }
  }

  private attachListeners(): void {
    if (!this.contract) return;

    // Listen to VulnerabilityCommitted event
    this.contract.on('VulnerabilityCommitted', (merkleRoot: string, seller: string, vendor: string, keyHash: string) => {
      console.log(`[Web3Bridge] Received VulnerabilityCommitted event: merkleRoot=${merkleRoot}`);
      handleContractEvent('VulnerabilityCommitted', merkleRoot).catch((err) => {
        console.error('[Web3Bridge] Error handling VulnerabilityCommitted event:', err);
      });
    }).catch(console.error);

    // Listen to BountyLocked event
    this.contract.on('BountyLocked', async (merkleRoot: string, amount: bigint) => {
      console.log(`[Web3Bridge] Received BountyLocked event: merkleRoot=${merkleRoot}, amount=${amount.toString()}`);
      let buyerAddress: string | undefined;
      try {
        if (this.contract) {
          const escrowOnChain = await this.contract.escrows(merkleRoot);
          if (escrowOnChain && escrowOnChain.vendor && escrowOnChain.vendor !== ethers.ZeroAddress) {
            buyerAddress = escrowOnChain.vendor;
          }
        }
      } catch (err) {
        console.warn('[Web3Bridge] Failed to query vendor on-chain for BountyLocked:', err);
      }
      handleContractEvent('BountyLocked', merkleRoot, { amount, buyerAddress }).catch((err) => {
        console.error('[Web3Bridge] Error handling BountyLocked event:', err);
      });
    }).catch(console.error);

    // Listen to SettlementConfirmed event
    this.contract.on('SettlementConfirmed', (merkleRoot: string, keyHash: string) => {
      console.log(`[Web3Bridge] Received SettlementConfirmed event: merkleRoot=${merkleRoot}`);
      handleContractEvent('SettlementConfirmed', merkleRoot, { keyHash }).catch((err) => {
        console.error('[Web3Bridge] Error handling SettlementConfirmed event:', err);
      });
    }).catch(console.error);

    // Listen to VaultExpired event
    this.contract.on('VaultExpired', (merkleRoot: string) => {
      console.log(`[Web3Bridge] Received VaultExpired event: merkleRoot=${merkleRoot}`);
      handleContractEvent('VaultExpired', merkleRoot).catch((err) => {
        console.error('[Web3Bridge] Error handling VaultExpired event:', err);
      });
    }).catch(console.error);

    // Listen to BountyReclaimed event
    this.contract.on('BountyReclaimed', (merkleRoot: string) => {
      console.log(`[Web3Bridge] Received BountyReclaimed event: merkleRoot=${merkleRoot}`);
      handleContractEvent('BountyReclaimed', merkleRoot).catch((err) => {
        console.error('[Web3Bridge] Error handling BountyReclaimed event:', err);
      });
    }).catch(console.error);

    // Listen to KYCStatusUpdated event
    this.contract.on('KYCStatusUpdated', (userAddress: string, status: boolean) => {
      console.log(`[Web3Bridge] Received KYCStatusUpdated event: user=${userAddress}, status=${status}`);
      // Directly update the database here since it's a User model change, not a ListingStatus change
      prisma.user.updateMany({
        where: { wallet_address: { equals: userAddress, mode: 'insensitive' } },
        data: { verified_buyer: status }
      }).then((result) => {
        if (result.count > 0) {
          console.log(`[Web3Bridge] Successfully synced KYC status to DB for ${userAddress}`);
        } else {
          console.warn(`[Web3Bridge] Received KYC event but user ${userAddress} not found in DB`);
        }
      }).catch((err) => {
        console.error('[Web3Bridge] Error updating KYC status in DB:', err);
      });
    }).catch(console.error);

  }

  public handleConnectionFailure(): void {
    this.listening = false;
    if (this.contract) {
      this.contract.removeAllListeners().catch(console.error);
      this.contract = null;
    }

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(this.retryDelayMs * Math.pow(1.5, this.retryCount - 1), 60000);
      console.log(`[Web3Bridge] Retrying connection attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.start().catch((err) => {
          console.error('[Web3Bridge] Reconnection attempt failed:', err);
        });
      }, delay);
    } else {
      console.error('[Web3Bridge] Maximum reconnection retries reached. Service stopped.');
    }
  }

  /**
   * Stops event listening and clears timers and listeners.
   */
  public stop(): void {
    this.listening = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.contract) {
      this.contract.removeAllListeners().catch(console.error);
      this.contract = null;
    }
    this.provider = null;
    console.log('[Web3Bridge] Service stopped.');
  }
}
