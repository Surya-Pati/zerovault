import { Request, Response } from 'express';
import { PrismaClient, ListingStatus } from '@prisma/client';
import { z } from 'zod';
import { keccak256, toUtf8Bytes } from 'ethers';

const prisma = new PrismaClient();

// Zod validation schemas
export const fundEscrowSchema = z
  .object({
    listing_id: z.string().min(1, 'listing_id cannot be empty').optional(),
    listingId: z.string().min(1, 'listingId cannot be empty').optional(),
    tx_hash: z.string().min(1, 'tx_hash cannot be empty').optional(),
    txHash: z.string().min(1, 'txHash cannot be empty').optional(),
    contract_address: z.string().optional(),
  })
  .refine((data: Record<string, any>) => Boolean(data.listing_id || data.listingId), {
    message: 'listing_id is required',
    path: ['listing_id'],
  })
  .refine((data: Record<string, any>) => Boolean(data.tx_hash || data.txHash), {
    message: 'tx_hash is required',
    path: ['tx_hash'],
  });

export const revealEscrowSchema = z
  .object({
    decryptionKey: z.string().min(1, 'decryptionKey cannot be empty').optional(),
    decryption_key: z.string().min(1, 'decryption_key cannot be empty').optional(),
    merkleRoot: z.string().min(1, 'merkleRoot cannot be empty').optional(),
    merkle_root: z.string().min(1, 'merkle_root cannot be empty').optional(),
    listing_id: z.string().optional(),
    listingId: z.string().optional(),
    tx_hash: z.string().optional(),
    tx_hash_settle: z.string().optional(),
  })
  .refine((data: Record<string, any>) => Boolean(data.decryptionKey || data.decryption_key), {
    message: 'decryptionKey is required',
    path: ['decryptionKey'],
  })
  .refine(
    (data: Record<string, any>) => Boolean(data.merkleRoot || data.merkle_root || data.listing_id || data.listingId),
    {
      message: 'merkleRoot or listing_id is required',
      path: ['merkleRoot'],
    }
  );

/**
 * POST /api/escrow/fund
 * Validates listing_id and tx_hash, updates escrow state to BOUNTY_LOCKED in DB.
 */
export const fundEscrow = async (req: Request, res: Response) => {
  const parseResult = fundEscrowSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const data = parseResult.data;
  const listingId = (data.listing_id || data.listingId)!;
  const txHash = (data.tx_hash || data.txHash)!;
  const user = (req as any).user;

  if (user.role !== 'BUYER' && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only buyers can fund escrows' });
  }

  try {
    const listing = await prisma.vulnerabilityListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Vulnerability listing not found' });
    }

    const defaultContractAddress =
      process.env.ZEROVAULT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
    const contractAddress = data.contract_address || defaultContractAddress;

    // Upsert EscrowTransaction
    const escrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: listingId },
      update: {
        tx_hash_fund: txHash,
        buyer_id: user.id,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
        contract_address: contractAddress,
      },
      create: {
        listing_id: listingId,
        buyer_id: user.id,
        contract_address: contractAddress,
        tx_hash_fund: txHash,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
      },
    });

    // Update VulnerabilityListing status
    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id: listingId },
      data: { status: ListingStatus.BOUNTY_LOCKED },
    });

    return res.json({
      message: 'Escrow funded successfully',
      escrow,
      listing: updatedListing,
    });
  } catch (error) {
    console.error('[EscrowController] fundEscrow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/escrow/reveal
 * Validates decryptionKey and merkleRoot, updates escrow state to SETTLED in DB.
 */
export const revealEscrow = async (req: Request, res: Response) => {
  const parseResult = revealEscrowSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const data = parseResult.data;
  const decryptionKey = (data.decryptionKey || data.decryption_key)!;
  const merkleRoot = data.merkleRoot || data.merkle_root;
  const listingId = data.listing_id || data.listingId;
  const txHashSettle = data.tx_hash_settle || data.tx_hash;

  try {
    let listing = null;
    if (listingId) {
      listing = await prisma.vulnerabilityListing.findUnique({ where: { id: listingId } });
    }
    if (!listing && merkleRoot) {
      listing = await prisma.vulnerabilityListing.findFirst({
        where: { merkle_root: merkleRoot },
      });
    }

    if (!listing) {
      return res.status(404).json({ error: 'Vulnerability listing not found' });
    }

    const user = (req as any).user;

    // Authorization: only the seller can reveal the key
    if (listing.seller_id && user.id && listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'Only the listing seller can reveal the key' });
    }

    // Verify that the provided decryptionKey matches the listing's committed key_hash BEFORE any database write
    if (listing.key_hash) {
      const cleanKey = decryptionKey.trim().replace(/^0x/i, '').toLowerCase();
      const computedKeyHash = keccak256(toUtf8Bytes(cleanKey)).toLowerCase();
      const cleanListingKeyHash = (listing.key_hash.startsWith('0x') ? listing.key_hash : `0x${listing.key_hash}`).toLowerCase();
      if (computedKeyHash !== cleanListingKeyHash) {
        return res.status(400).json({ error: 'Decryption key does not match committed key hash' });
      }
    }

    // Upsert or update EscrowTransaction
    const existingEscrow = await prisma.escrowTransaction.findUnique({
      where: { listing_id: listing.id },
    });

    const defaultContractAddress =
      process.env.ZEROVAULT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

    const escrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: listing.id },
      update: {
        status: ListingStatus.SETTLED,
        ...(txHashSettle ? { tx_hash_settle: txHashSettle } : {}),
      },
      create: {
        listing_id: listing.id,
        buyer_id: existingEscrow?.buyer_id || user.id,
        contract_address: existingEscrow?.contract_address || defaultContractAddress,
        status: ListingStatus.SETTLED,
        tx_hash_settle: txHashSettle || null,
      },
    });

    // Update VulnerabilityListing status
    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.SETTLED },
    });

    return res.json({
      message: 'Decryption key revealed and escrow settled successfully',
      decryptionKey,
      escrow,
      listing: updatedListing,
    });
  } catch (error) {
    console.error('[EscrowController] revealEscrow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/escrow/:id
 * Gets current escrow status and transaction details.
 */
export const getEscrowStatus = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Escrow ID parameter is required' });
  }

  try {
    const escrow = await prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { id: id },
          { listing_id: id },
          { listing: { merkle_root: id } },
        ],
      },
      include: {
        listing: true,
        buyer: {
          select: {
            id: true,
            wallet_address: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!escrow) {
      // Check if listing exists without escrow record yet
      const listing = await prisma.vulnerabilityListing.findFirst({
        where: {
          OR: [{ id: id }, { merkle_root: id }],
        },
      });

      if (listing) {
        return res.json({
          escrow: null,
          status: listing.status,
          listing,
        });
      }

      return res.status(404).json({ error: 'Escrow transaction not found' });
    }

    return res.json({
      escrow,
      status: escrow.status,
      tx_hash_fund: escrow.tx_hash_fund,
      tx_hash_settle: escrow.tx_hash_settle,
      contract_address: escrow.contract_address,
      bounty_locked_at: escrow.bounty_locked_at,
      listing: escrow.listing,
      buyer: escrow.buyer,
    });
  } catch (error) {
    console.error('[EscrowController] getEscrowStatus error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
