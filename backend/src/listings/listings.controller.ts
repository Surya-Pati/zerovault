import { Request, Response } from 'express';
import { PrismaClient, ListingStatus } from '@prisma/client';
import { MerkleService } from '../services/merkle';
import { encryptPayload } from '@zerovault/shared';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { keccak256, toUtf8Bytes, JsonRpcProvider } from 'ethers';

const prisma = new PrismaClient();
const PUBLIC_STORAGE_DIR = path.join(__dirname, '../../storage/public');

// ─── Zod Validation Schemas ─────────────────────────────────────────
const createListingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  category: z.string().min(1, 'Category is required').max(100).trim(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Severity must be LOW, MEDIUM, HIGH, or CRITICAL' }),
  }),
  price_wei: z.string().min(1, 'Price is required').regex(/^\d+$/, 'price_wei must be a numeric string'),
  vendor_id: z.string().optional(),
  claims: z.any().optional(), // We accept the full claims array built on the frontend
  ciphertext: z.string().min(1, 'Ciphertext is required'),
  iv: z.string().min(1, 'IV is required'),
  keyHash: z.string().min(1, 'keyHash is required'),
  merkleRoot: z.string().min(1, 'merkleRoot is required'),
});

const commitListingSchema = z.object({
  tx_hash_commit: z.string().optional(),
  contract_address: z.string().optional(),
});

const fundEscrowSchema = z.object({
  tx_hash_fund: z.string().min(1, 'tx_hash_fund is required').regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  contract_address: z.string().optional(),
});

const settleEscrowSchema = z.object({
  tx_hash_settle: z.string().min(1, 'tx_hash_settle is required').regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
  decryptionKey: z.string().min(1, 'decryptionKey is required'),
});

// ─── Path Traversal Guard ───────────────────────────────────────────
// Validates that a listing ID is safe for use in file paths
function sanitizeListingId(id: string): string {
  // Only allow UUIDs and alphanumeric-dash-underscore patterns
  if (!/^[a-zA-Z0-9\-_]+$/.test(id)) {
    throw new Error('Invalid listing ID format');
  }
  return id;
}

// ─── Create Listing ─────────────────────────────────────────────────
export const createListing = async (req: Request, res: Response) => {
  const parseResult = createListingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { title, category, severity, price_wei, vendor_id, claims, ciphertext, iv, keyHash, merkleRoot } = parseResult.data;
  const user = (req as any).user;

  // user is guaranteed by requireAuth middleware
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let vendor_address: string | undefined;
    if (vendor_id) {
      const vendorUser = await prisma.user.findUnique({ where: { id: vendor_id } });
      if (vendorUser && vendorUser.wallet_address) {
        vendor_address = vendorUser.wallet_address.toLowerCase();
      }
    }

    const listing = await prisma.vulnerabilityListing.create({
      data: {
        seller_id: user.id,
        title,
        category,
        severity,
        merkle_root: merkleRoot,
        price_wei: price_wei.toString(),
        key_hash: keyHash,
        vendor_address,
        claims: claims || [],
      },
    });

    // Write encrypted payload to disk
    if (!fs.existsSync(PUBLIC_STORAGE_DIR)) {
      fs.mkdirSync(PUBLIC_STORAGE_DIR, { recursive: true });
    }
    const filename = `${listing.id}.enc`;
    const filePath = path.join(PUBLIC_STORAGE_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify({
      ciphertext,
      iv
    }));

    // Update listing with file path
    await prisma.vulnerabilityListing.update({
      where: { id: listing.id },
      data: { encrypted_payload_uri: filePath },
    });

    res.status(201).json({
      success: true,
      listing: {
        id: listing.id,
        title: listing.title,
        category: listing.category,
        severity: listing.severity,
        merkle_root: listing.merkle_root,
        price_wei: listing.price_wei,
        status: listing.status,
      },
    });
  } catch (error: any) {
    console.error('[Listings] Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

// ─── Get All Listings ───────────────────────────────────────────────
export const getListings = async (_req: Request, res: Response) => {
  try {
    const listings = await prisma.vulnerabilityListing.findMany({
      include: { escrow: true, seller: true },
    });
    res.json({ listings });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve listings' });
  }
};

import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/auth.middleware';

// ─── Get Listing By ID ──────────────────────────────────────────────
export const getListingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  let user: any = null;
  
  const token = req.cookies?.session || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      user = await prisma.user.findUnique({ where: { id: payload.userId } });
    } catch (e) {}
  }
  
  try {
    const listing = await prisma.vulnerabilityListing.findUnique({
      where: { id },
      include: { escrow: true, seller: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const isBuyer = user && (
      (listing.escrow?.buyer_id === user.id) ||
      (listing.vendor_address && user.wallet_address && listing.vendor_address.toLowerCase() === user.wallet_address.toLowerCase())
    );
    const isSeller = user && listing.seller_id === user.id;
    const isAdmin = user && user.role === 'ADMIN';
    const isSettledBuyer = isBuyer && listing.status === ListingStatus.SETTLED;
    const canViewAllClaims = isSeller || isAdmin || isSettledBuyer;

    // Protect decryption_key from unauthorized access
    if (listing.escrow && listing.escrow.decryption_key) {
      if (!isSettledBuyer && !isSeller && !isAdmin) {
        (listing.escrow as any).decryption_key = null;
      }
    }

    // LOG-M5-02: Never leak hidden/unrevealed claims to unauthenticated or pre-purchase requesters.
    // A claim is public/revealed if explicitly flagged (revealed/public) OR if a disclosure proof was generated for it.
    if (!canViewAllClaims && listing.claims) {
      if (Array.isArray(listing.claims)) {
        listing.claims = (listing.claims as any[])
          .filter((c: any) => c && (
            c.revealed === true ||
            c.is_revealed === true ||
            c.public === true ||
            (Array.isArray(c.proof) && c.proof.length > 0)
          ))
          .map((c: any) => ({
            key: c.key,
            value: c.value,
            revealed: true,
            ...(c.proof ? { proof: c.proof } : {}),
            ...(c.salt ? { salt: c.salt } : {}),
          }));
      } else {
        listing.claims = [];
      }
    }

    res.json({ listing });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve listing' });
  }
};

// ─── Commit Escrow Listing ──────────────────────────────────────────
export const commitListing = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.seller_id !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized: Only the seller or an admin can commit this listing.' });
    }

    const updated = await prisma.vulnerabilityListing.update({
      where: { id },
      data: { status: ListingStatus.COMMITTED },
    });

    const defaultContract = process.env.ZEROVAULT_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    let escrow = await prisma.escrowTransaction.findFirst({ where: { listing_id: id } });
    if (escrow) {
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: ListingStatus.COMMITTED },
      });
    } else {
      await prisma.escrowTransaction.create({
        data: {
          listing_id: id,
          buyer_id: listing.seller_id,
          contract_address: defaultContract,
          status: ListingStatus.COMMITTED,
        },
      });
    }

    console.log(`[Listings] Listing ${id} (${listing.title}) status set to COMMITTED in database.`);
    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error('[Listings] Error committing listing:', error);
    return res.status(500).json({ error: 'Failed to commit listing' });
  }
};

// ─── Fund Escrow ────────────────────────────────────────────────────
export const fundEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const parseResult = fundEscrowSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log(`[fundEscrow] Validation failed:`, parseResult.error.flatten().fieldErrors);
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { tx_hash_fund } = parseResult.data;
  const contractAddr = process.env.ZEROVAULT_CONTRACT_ADDRESS;
  if (!contractAddr) {
    return res.status(500).json({ error: 'Server misconfiguration: ZEROVAULT_CONTRACT_ADDRESS not set' });
  }

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Security Check: Sellers cannot fund their own listings
    // TEMPORARILY DISABLED for local testing so you can test both roles simultaneously!
    // if (listing.seller_id === user.id) {
    //   return res.status(403).json({ error: 'Cannot fund your own listing' });
    // }

    // Verify transaction on-chain
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new JsonRpcProvider(rpcUrl);
    let receipt = null;
    for (let i = 0; i < 5; i++) {
      receipt = await provider.getTransactionReceipt(tx_hash_fund);
      if (receipt) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (!receipt || receipt.status === 0) {
      console.log(`[fundEscrow] Failed at receipt. Tx: ${tx_hash_fund}, Status: ${receipt?.status}`);
      return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
    }
    if (receipt.to?.toLowerCase() !== contractAddr.toLowerCase()) {
      console.log(`[fundEscrow] Failed at receipt.to. Receipt to: ${receipt.to}, Expected: ${contractAddr}`);
      return res.status(400).json({ error: 'Transaction was not sent to the ZeroVault contract.' });
    }
    if (!receipt.logs || receipt.logs.length === 0) {
      console.log(`[fundEscrow] Failed at receipt.logs length 0`);
      return res.status(400).json({ error: 'Transaction did not emit any events. The smart contract might be missing or the call was invalid.' });
    }

    // Decode event to check the amount
    const ethers = await import('ethers');
    const ifaceInstance = new ethers.Interface([
      'event BountyLocked(bytes32 indexed merkleRoot, uint256 amount)'
    ]);
    
    let paidAmount = BigInt(0);
    let matchedRoot = false;
    for (const log of receipt.logs) {
      try {
        const parsed = ifaceInstance.parseLog(log);
        if (parsed && parsed.name === 'BountyLocked' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
          paidAmount = parsed.args.amount;
          matchedRoot = true;
          break;
        }
      } catch (e) {}
    }

    if (!matchedRoot) {
      return res.status(400).json({ error: 'Transaction did not emit BountyLocked for this listing.' });
    }

    if (paidAmount < BigInt(listing.price_wei)) {
      console.log(`[fundEscrow] Underpayment: Paid ${paidAmount.toString()}, required ${listing.price_wei}`);
      return res.status(400).json({ error: `Underpayment: Required ${listing.price_wei} WEI but transaction only locked ${paidAmount.toString()} WEI` });
    }

    // Authorization: only BUYER or ADMIN role can fund
    if (user.role !== 'BUYER' && user.role !== 'ADMIN') {
      console.log(`[fundEscrow] Failed at user role: ${user.role}`);
      return res.status(403).json({ error: 'Only buyers or administrators can fund escrows' });
    }
    
    if (user.role === 'BUYER' && !user.verified_buyer) {
      console.log(`[fundEscrow] Failed at verified_buyer: false`);
      return res.status(403).json({ error: 'Only admin-verified buyers can fund escrows' });
    }

    // Cannot fund your own listing
    if (listing.seller_id === user.id) {
      console.log(`[fundEscrow] 403: seller_id ${listing.seller_id} === user.id ${user.id}`);
      return res.status(403).json({ error: 'Cannot fund your own listing' });
    }

    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id },
      data: { status: ListingStatus.BOUNTY_LOCKED },
    });

    const escrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: id },
      update: {
        tx_hash_fund,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
        buyer_id: user.id, // OVERRIDE the bridge's placeholder buyer_id!
      },
      create: {
        listing_id: id,
        buyer_id: user.id,
        contract_address: contractAddr,
        tx_hash_fund,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
      },
    });

    res.json({ success: true, listing: updatedListing, escrow });
  } catch (error: any) {
    console.error('[Listings] Error funding escrow:', error);
    res.status(500).json({ error: 'Failed to fund escrow' });
  }
};

// ─── Expire Escrow ──────────────────────────────────────────────────
export const expireEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const tx_hash_expire = req.body?.tx_hash_expire;
  if (!tx_hash_expire || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash_expire)) {
    return res.status(400).json({ error: 'Valid tx_hash_expire is required' });
  }

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id !== user.id) return res.status(403).json({ error: 'Only the seller can expire the listing' });

    // Verify transaction on-chain
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const contractAddr = process.env.ZEROVAULT_CONTRACT_ADDRESS;
    if (!contractAddr) {
      return res.status(500).json({ error: 'Server misconfiguration: ZEROVAULT_CONTRACT_ADDRESS not set' });
    }
    const ethers = await import('ethers');
    const providerInstance = new ethers.JsonRpcProvider(rpcUrl);
    
    let receipt = null;
    for (let i = 0; i < 5; i++) {
      receipt = await providerInstance.getTransactionReceipt(tx_hash_expire);
      if (receipt) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!receipt || receipt.status === 0) {
      return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
    }
    if (receipt.to?.toLowerCase() !== contractAddr.toLowerCase()) {
      return res.status(400).json({ error: 'Transaction was not sent to the ZeroVault contract.' });
    }
    if (!receipt.logs || receipt.logs.length === 0) {
      return res.status(400).json({ error: 'Transaction did not emit any events.' });
    }

    const ifaceInstance = new ethers.Interface([
      'event VaultExpired(bytes32 indexed merkleRoot)'
    ]);
    
    let matchedRoot = false;
    for (const log of receipt.logs) {
      try {
        const parsed = ifaceInstance.parseLog(log);
        if (parsed && parsed.name === 'VaultExpired' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
          matchedRoot = true;
          break;
        }
      } catch (e) {}
    }

    if (!matchedRoot) {
      return res.status(400).json({ error: 'Transaction did not emit VaultExpired for this listing.' });
    }

    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id },
      data: { status: ListingStatus.EXPIRED },
    });

    // Check if escrow exists first (it's a relation, so we should query it or safely try-catch, but Prisma lets us do this)
    const escrow = await prisma.escrowTransaction.findUnique({ where: { listing_id: id } });
    if (escrow) {
      await prisma.escrowTransaction.update({
        where: { listing_id: id },
        data: { status: ListingStatus.EXPIRED },
      });
    }

    res.json({ success: true, listing: updatedListing });
  } catch (error: any) {
    console.error('[Listings] Expire escrow error:', error.message);
    res.status(500).json({ error: 'Failed to expire escrow' });
  }
};

// ─── Reclaim Escrow ──────────────────────────────────────────────────
export const reclaimEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const tx_hash_reclaim = req.body?.tx_hash_reclaim;
  if (!tx_hash_reclaim || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash_reclaim)) {
    return res.status(400).json({ error: 'Valid tx_hash_reclaim is required' });
  }

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({ where: { id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Verify transaction on-chain
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const contractAddr = process.env.ZEROVAULT_CONTRACT_ADDRESS;
    if (!contractAddr) {
      return res.status(500).json({ error: 'Server misconfiguration: ZEROVAULT_CONTRACT_ADDRESS not set' });
    }
    const ethers = await import('ethers');
    const providerInstance = new ethers.JsonRpcProvider(rpcUrl);
    
    let receipt = null;
    for (let i = 0; i < 5; i++) {
      receipt = await providerInstance.getTransactionReceipt(tx_hash_reclaim);
      if (receipt) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!receipt || receipt.status === 0) {
      return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
    }
    if (receipt.to?.toLowerCase() !== contractAddr.toLowerCase()) {
      return res.status(400).json({ error: 'Transaction was not sent to the ZeroVault contract.' });
    }
    if (!receipt.logs || receipt.logs.length === 0) {
      return res.status(400).json({ error: 'Transaction did not emit any events.' });
    }

    const ifaceInstance = new ethers.Interface([
      'event BountyReclaimed(bytes32 indexed merkleRoot)'
    ]);
    
    let matchedRoot = false;
    for (const log of receipt.logs) {
      try {
        const parsed = ifaceInstance.parseLog(log);
        if (parsed && parsed.name === 'BountyReclaimed' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
          matchedRoot = true;
          break;
        }
      } catch (e) {}
    }

    if (!matchedRoot) {
      return res.status(400).json({ error: 'Transaction did not emit BountyReclaimed for this listing.' });
    }

    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id },
      data: { status: ListingStatus.REFUNDED },
    });

    const escrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: id },
      update: {
        status: ListingStatus.REFUNDED,
      },
      create: {
        listing_id: id,
        buyer_id: user.id,
        contract_address: contractAddr,
        status: ListingStatus.REFUNDED,
      },
    });

    res.json({ success: true, listing: updatedListing });
  } catch (error: any) {
    console.error('[Listings] Reclaim escrow error:', error.message);
    res.status(500).json({ error: 'Failed to reclaim escrow' });
  }
};

// ─── Settle Escrow ──────────────────────────────────────────────────
export const settleEscrow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  const parseResult = settleEscrowSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.log(`[settleEscrow] Validation failed:`, parseResult.error.flatten().fieldErrors);
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { tx_hash_settle, decryptionKey } = parseResult.data;

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Authorization: only the seller can settle (they are the ones revealing the key)
    if (listing.seller_id !== user.id) {
      console.log(`[settleEscrow] Failed at user role. Seller: ${listing.seller_id}, User: ${user.id}`);
      return res.status(403).json({ error: 'Only the listing seller can settle' });
    }

    // Verify transaction on-chain
    const contractAddr = process.env.ZEROVAULT_CONTRACT_ADDRESS;
    if (!contractAddr) {
      return res.status(500).json({ error: 'Server misconfiguration: ZEROVAULT_CONTRACT_ADDRESS not set' });
    }
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new JsonRpcProvider(rpcUrl);
    let receipt = null;
    for (let i = 0; i < 5; i++) {
      receipt = await provider.getTransactionReceipt(tx_hash_settle);
      if (receipt) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!receipt || receipt.status === 0) {
      console.log(`[settleEscrow] Failed at receipt. Tx: ${tx_hash_settle}, Status: ${receipt?.status}`);
      return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
    }
    if (receipt.to?.toLowerCase() !== contractAddr.toLowerCase()) {
      console.log(`[settleEscrow] Failed at receipt.to. Receipt to: ${receipt.to}, Expected: ${contractAddr}`);
      return res.status(400).json({ error: 'Transaction was not sent to the ZeroVault contract.' });
    }
    if (!receipt.logs || receipt.logs.length === 0) {
      console.log(`[settleEscrow] Failed at receipt.logs length 0`);
      return res.status(400).json({ error: 'Transaction did not emit any events. The smart contract might be missing or the call was invalid.' });
    }

    const ethersModule = await import('ethers');
    const ifaceInstance = new ethersModule.Interface([
      'event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash)'
    ]);
    
    let matchedRoot = false;
    for (const log of receipt.logs) {
      try {
        const parsed = ifaceInstance.parseLog(log);
        if (parsed && parsed.name === 'SettlementConfirmed' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
          matchedRoot = true;
          break;
        }
      } catch (e) {}
    }

    if (!matchedRoot) {
      return res.status(400).json({ error: 'Transaction did not emit SettlementConfirmed for this listing.' });
    }

    // Verify that the provided decryptionKey matches the listing's committed key_hash BEFORE any database write
    const cleanKey = decryptionKey.trim().replace(/^0x/i, '').toLowerCase();
    const computedKeyHash = keccak256(toUtf8Bytes(cleanKey)).toLowerCase();
    const cleanListingKeyHash = listing.key_hash 
      ? (listing.key_hash.startsWith('0x') ? listing.key_hash : `0x${listing.key_hash}`).toLowerCase()
      : null;
    if (cleanListingKeyHash && computedKeyHash !== cleanListingKeyHash) {
      return res.status(400).json({ error: 'Decryption key does not match committed key hash' });
    }

    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id },
      data: { status: ListingStatus.SETTLED },
      include: { escrow: true }
    });

    if (updatedListing.escrow) {
      await prisma.escrowTransaction.update({
        where: { id: updatedListing.escrow.id },
        data: {
          tx_hash_settle,
          status: ListingStatus.SETTLED,
          decryption_key: decryptionKey,
        },
      });
    }

    res.json({ success: true, listing: updatedListing, decryptionKey });
  } catch (error: any) {
    console.error('[Listings] Error settling escrow:', error);
    res.status(500).json({ error: 'Failed to settle escrow' });
  }
};

// ─── Download Payload ───────────────────────────────────────────────
export const downloadPayload = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const listingId = req.params.id;

  // Path traversal guard
  try {
    sanitizeListingId(listingId);
  } catch {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({
      where: { id: listingId },
      include: { escrow: true },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Must be in SETTLED state (atomic settlement — no intermediate states)
    if (listing.status !== ListingStatus.SETTLED) {
      return res.status(403).json({
        error: 'Payload is only accessible after settlement is complete',
      });
    }

    // Authorization: must be the purchasing buyer
    const isPurchasingBuyer = (listing.escrow && listing.escrow.buyer_id === user.id) || 
                              (listing.vendor_address && listing.vendor_address.toLowerCase() === user.wallet_address.toLowerCase());
    if (!isPurchasingBuyer) {
      return res.status(403).json({
        error: 'Only the buyer who funded this listing can download the payload',
      });
    }

    // Resolve payload file path safely
    const filename = `${listingId}.enc`;
    let payloadFilePath: string | null = null;

    // Check database URI first
    if (listing.encrypted_payload_uri && fs.existsSync(listing.encrypted_payload_uri)) {
      const resolved = path.resolve(listing.encrypted_payload_uri);
      // Ensure the resolved path is within our storage directories
      const storageBase = path.resolve(path.join(__dirname, '../../storage'));
      if (resolved.startsWith(storageBase)) {
        payloadFilePath = resolved;
      }
    }
    
    // Check private storage
    if (!payloadFilePath) {
      const privateCandidate = path.join(__dirname, '../../storage/private', filename);
      if (fs.existsSync(privateCandidate)) {
        payloadFilePath = path.resolve(privateCandidate);
      }
    }

    // Check public storage
    if (!payloadFilePath) {
      const publicCandidate = path.join(__dirname, '../../storage/public', filename);
      if (fs.existsSync(publicCandidate)) {
        payloadFilePath = path.resolve(publicCandidate);
      }
    }

    if (!payloadFilePath || !fs.existsSync(payloadFilePath)) {
      return res.status(404).json({ error: 'Payload file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(payloadFilePath);
  } catch (error: any) {
    console.error('[Listings] Error retrieving payload');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
