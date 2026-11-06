import fs from 'fs';
import path from 'path';
import { PrismaClient, ListingStatus } from '@prisma/client';
import { Contract, Provider } from 'ethers';

const prisma = new PrismaClient();

// Configurable storage paths
export const PUBLIC_STORAGE_DIR =
  process.env.PUBLIC_STORAGE_DIR || path.join(__dirname, '../../storage/public');
export const PRIVATE_STORAGE_DIR =
  process.env.PRIVATE_STORAGE_DIR || path.join(__dirname, '../../storage/private');

export interface PayloadWorkerOptions {
  intervalMs?: number;
  provider?: Provider;
  contractAddress?: string;
  contractAbi?: any[];
}

/**
 * Ensures public and private storage directories exist.
 */
export function ensureStorageDirectories(): void {
  if (!fs.existsSync(PUBLIC_STORAGE_DIR)) {
    fs.mkdirSync(PUBLIC_STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(PRIVATE_STORAGE_DIR)) {
    fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Moves an encrypted payload file from public storage to private storage
 * for a given settled listing, and deletes the public copy.
 *
 * @param listingId ID of the settled listing
 * @returns boolean indicating whether a migration occurred
 */
export async function migratePayload(listingId: string): Promise<boolean> {
  ensureStorageDirectories();

  const listing = await prisma.vulnerabilityListing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    console.warn(`[PayloadWorker] Listing ${listingId} not found`);
    return false;
  }

  if (listing.status !== ListingStatus.SETTLED) {
    console.log(`[PayloadWorker] Listing ${listingId} is not SETTLED (current status: ${listing.status}). Skipping migration.`);
    return false;
  }

  // Determine source file location
  let sourcePath: string | null = null;
  let filename = `${listingId}.enc`;

  if (listing.encrypted_payload_uri) {
    const rawUri = listing.encrypted_payload_uri;
    const baseName = path.basename(rawUri);
    filename = baseName;

    if (fs.existsSync(rawUri)) {
      sourcePath = rawUri;
    } else {
      const candidatePublicPath = path.join(PUBLIC_STORAGE_DIR, baseName);
      if (fs.existsSync(candidatePublicPath)) {
        sourcePath = candidatePublicPath;
      }
    }
  } else {
    const candidatePublicPath = path.join(PUBLIC_STORAGE_DIR, filename);
    if (fs.existsSync(candidatePublicPath)) {
      sourcePath = candidatePublicPath;
    }
  }

  // Also check default public path by listing ID if source not found yet
  if (!sourcePath) {
    const fallbackPath = path.join(PUBLIC_STORAGE_DIR, `${listingId}.enc`);
    if (fs.existsSync(fallbackPath)) {
      sourcePath = fallbackPath;
      filename = `${listingId}.enc`;
    }
  }

  // Target private destination path
  const targetPath = path.join(PRIVATE_STORAGE_DIR, filename);

  // If source file is already in private storage and not in public storage, check if already migrated
  if (!sourcePath) {
    if (fs.existsSync(targetPath)) {
      return true;
    }
    return false;
  }

  // Move file from public to private storage
  try {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedTarget = path.resolve(targetPath);
    
    // If it's already in the target location, we're done
    if (resolvedSource === resolvedTarget) {
      return true;
    }

    await fs.promises.copyFile(sourcePath, targetPath);

    // Delete public copy
    if (fs.existsSync(sourcePath)) {
      await fs.promises.unlink(sourcePath);
    }

    // Update database record to point to private path
    const relativePrivateUri = path.join('storage/private', filename).replace(/\\/g, '/');
    await prisma.vulnerabilityListing.update({
      where: { id: listingId },
      data: {
        encrypted_payload_uri: relativePrivateUri,
      },
    });

    console.log(`[PayloadWorker] Successfully migrated payload for listing ${listingId} to ${targetPath} and deleted public copy.`);
    return true;
  } catch (err) {
    console.error(`[PayloadWorker] Error migrating payload for listing ${listingId}:`, err);
    throw err;
  }
}

/**
 * Sweeps all SETTLED listings and moves any remaining public payload files to private storage.
 */
export async function processSettledListings(): Promise<number> {
  ensureStorageDirectories();

  const settledListings = await prisma.vulnerabilityListing.findMany({
    where: {
      status: ListingStatus.SETTLED,
    },
  });

  let count = 0;
  for (const listing of settledListings) {
    try {
      const migrated = await migratePayload(listing.id);
      if (migrated) count++;
    } catch (err) {
      console.error(`[PayloadWorker] Failed processing listing ${listing.id}:`, err);
    }
  }

  return count;
}

/**
 * Starts the background payload migration worker.
 * Listens for smart contract SettlementConfirmed events and periodically sweeps DB for SETTLED listings.
 */
export function startPayloadWorker(options?: PayloadWorkerOptions) {
  ensureStorageDirectories();

  const intervalMs = options?.intervalMs ?? 10000; // default 10 seconds
  console.log(`[PayloadWorker] Starting background payload migration worker (interval: ${intervalMs}ms)...`);

  // Run initial sweep
  processSettledListings().catch((err) => {
    console.error('[PayloadWorker] Initial sweep error:', err);
  });

  // Set up periodic interval timer
  const timer = setInterval(() => {
    processSettledListings().catch((err) => {
      console.error('[PayloadWorker] Periodic sweep error:', err);
    });
  }, intervalMs);

  let contractListener: Contract | null = null;

  // If provider & contractAddress supplied, listen for SettlementConfirmed event
  if (options?.provider && options?.contractAddress && options?.contractAbi) {
    try {
      contractListener = new Contract(options.contractAddress, options.contractAbi, options.provider);
      console.log(`[PayloadWorker] Listening for SettlementConfirmed events on contract ${options.contractAddress}`);

      contractListener.on('SettlementConfirmed', async (merkleRoot: string, keyHash: string) => {
        console.log(`[PayloadWorker] Contract Event SettlementConfirmed received for merkleRoot: ${merkleRoot}`);
        try {
          // Find listing matching merkle root
          const listing = await prisma.vulnerabilityListing.findFirst({
            where: { merkle_root: merkleRoot },
          });

          if (listing) {
            // Update listing status if needed
            if (listing.status !== ListingStatus.SETTLED) {
              await prisma.vulnerabilityListing.update({
                where: { id: listing.id },
                data: { status: ListingStatus.SETTLED },
              });
            }
            // Execute immediate migration within 5 minutes requirement
            await migratePayload(listing.id);
          } else {
            console.warn(`[PayloadWorker] No listing found for merkleRoot ${merkleRoot}`);
          }
        } catch (err) {
          console.error(`[PayloadWorker] Error handling SettlementConfirmed event:`, err);
        }
      });
    } catch (err) {
      console.error('[PayloadWorker] Failed to attach contract event listener:', err);
    }
  }

  return {
    stop: () => {
      clearInterval(timer);
      if (contractListener) {
        contractListener.removeAllListeners();
      }
      console.log('[PayloadWorker] Worker stopped.');
    },
  };
}
