import { Request, Response } from 'express';
import { PrismaClient, ListingStatus } from '@prisma/client';
import { z } from 'zod';
import { keccak256, toUtf8Bytes, isHexString, getBytes, JsonRpcProvider, Interface } from 'ethers';
import { migratePayload } from '../services/payloadWorker';

const prisma = new PrismaClient();

const bountyLockedIfaceV2 = new Interface([
  'event BountyLocked(bytes32 indexed merkleRoot, address indexed buyer, uint256 amount, bytes buyerPublicKey)'
]);
const bountyLockedIfaceV1 = new Interface([
  'event BountyLocked(bytes32 indexed merkleRoot, uint256 amount)'
]);
const settlementIfaceV2 = new Interface([
  'event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash, bytes encryptedKey)'
]);
const settlementIfaceV1 = new Interface([
  'event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash)'
]);

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

    // Security Check: Sellers cannot fund their own listings
    if (listing.seller_id === user.id) {
      return res.status(403).json({ error: 'Cannot fund your own listing' });
    }

    const defaultContractAddress =
      process.env.ZEROVAULT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
    const contractAddress = data.contract_address || defaultContractAddress;

    // In live environments, verify transaction receipt and event logs on-chain
    let capturedBuyerPublicKey: string | null = null;
    let capturedBuyerAddress: string | null = null;
    if (txHash && process.env.NODE_ENV !== 'test' && !process.env.SKIP_ONCHAIN_VERIFY) {
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      const provider = new JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
      if (!receipt || receipt.status === 0) {
        return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
      }
      if (contractAddress && receipt.to && receipt.to.toLowerCase() !== contractAddress.toLowerCase()) {
        return res.status(400).json({ error: 'Transaction was not sent to the ZeroVault contract.' });
      }
      if (!receipt.logs || receipt.logs.length === 0) {
        return res.status(400).json({ error: 'Transaction did not emit any events.' });
      }

      let paidAmount = BigInt(0);
      let matchedRoot = false;
      for (const log of receipt.logs) {
        let parsed: any = null;
        try {
          parsed = bountyLockedIfaceV2.parseLog(log);
        } catch {}
        if (!parsed) {
          try {
            parsed = bountyLockedIfaceV1.parseLog(log);
          } catch {}
        }
        if (parsed && parsed.name === 'BountyLocked' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
          paidAmount = parsed.args.amount;
          if (parsed.args.buyer && typeof parsed.args.buyer === 'string' && parsed.args.buyer !== '0x0000000000000000000000000000000000000000') {
            capturedBuyerAddress = parsed.args.buyer;
          }
          if (parsed.args.buyerPublicKey && typeof parsed.args.buyerPublicKey === 'string' && parsed.args.buyerPublicKey !== '0x') {
            capturedBuyerPublicKey = parsed.args.buyerPublicKey;
          }
          matchedRoot = true;
          break;
        }
      }

      if (!matchedRoot) {
        return res.status(400).json({ error: 'Transaction did not emit BountyLocked for this listing.' });
      }

      if (paidAmount < BigInt(listing.price_wei)) {
        return res.status(400).json({ error: `Underpayment: Required ${listing.price_wei} WEI but transaction only locked ${paidAmount.toString()} WEI` });
      }
    }

    // Upsert EscrowTransaction
    const escrow = await prisma.escrowTransaction.upsert({
      where: { listing_id: listingId },
      update: {
        tx_hash_fund: txHash,
        buyer_id: user.id,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
        contract_address: contractAddress,
        ...(capturedBuyerPublicKey ? { buyer_public_key: capturedBuyerPublicKey } : {}),
      },
      create: {
        listing_id: listingId,
        buyer_id: user.id,
        contract_address: contractAddress,
        tx_hash_fund: txHash,
        status: ListingStatus.BOUNTY_LOCKED,
        bounty_locked_at: new Date(),
        ...(capturedBuyerPublicKey ? { buyer_public_key: capturedBuyerPublicKey } : {}),
      },
    });

    const buyerWallet = user.wallet_address || (capturedBuyerAddress ? capturedBuyerAddress : null);

    // Update VulnerabilityListing status
    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.BOUNTY_LOCKED,
        ...(!listing.vendor_address && buyerWallet ? { vendor_address: buyerWallet.toLowerCase() } : {}),
      },
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

    // In live environments, verify transaction receipt on-chain if settlement tx provided
    if (txHashSettle && process.env.NODE_ENV !== 'test' && !process.env.SKIP_ONCHAIN_VERIFY) {
      const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
      const provider = new JsonRpcProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(txHashSettle).catch(() => null);
      if (!receipt || receipt.status === 0) {
        return res.status(400).json({ error: 'Transaction failed or not found on-chain.' });
      }
      if (!receipt.logs || receipt.logs.length === 0) {
        return res.status(400).json({ error: 'Transaction did not emit any events.' });
      }
      let matchedRoot = false;
      for (const log of receipt.logs) {
        try {
          let parsed: any = null;
          try {
            parsed = settlementIfaceV2.parseLog(log);
          } catch {}
          if (!parsed) {
            try {
              parsed = settlementIfaceV1.parseLog(log);
            } catch {}
          }
          if (parsed && parsed.name === 'SettlementConfirmed' && parsed.args.merkleRoot.toLowerCase() === listing.merkle_root.toLowerCase()) {
            matchedRoot = true;
            break;
          }
        } catch {}
      }
      if (!matchedRoot) {
        return res.status(400).json({ error: 'Transaction did not emit SettlementConfirmed for this listing.' });
      }
    }

    const user = (req as any).user;

    // Authorization: only the seller can reveal the key
    if (listing.seller_id && user.id && listing.seller_id !== user.id) {
      return res.status(403).json({ error: 'Only the listing seller can reveal the key' });
    }

    // Verify that the provided decryptionKey matches the listing's committed key_hash BEFORE any database write
    if (listing.key_hash) {
      const cleanKey = decryptionKey.trim().replace(/^0x/i, '').toLowerCase();
      const hex = `0x${cleanKey}`;
      const rawByteHash = isHexString(hex, 32) ? keccak256(getBytes(hex)).toLowerCase() : null;
      const utf8Hash = keccak256(toUtf8Bytes(cleanKey)).toLowerCase();
      const cleanListingKeyHash = (listing.key_hash.startsWith('0x') ? listing.key_hash : `0x${listing.key_hash}`).toLowerCase();
      if (rawByteHash !== cleanListingKeyHash && utf8Hash !== cleanListingKeyHash) {
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
        decryption_key: decryptionKey,
        ...(txHashSettle ? { tx_hash_settle: txHashSettle } : {}),
      },
      create: {
        listing_id: listing.id,
        buyer_id: existingEscrow?.buyer_id || user.id,
        contract_address: existingEscrow?.contract_address || defaultContractAddress,
        status: ListingStatus.SETTLED,
        decryption_key: decryptionKey,
        tx_hash_settle: txHashSettle || null,
      },
    });

    // Update VulnerabilityListing status
    const updatedListing = await prisma.vulnerabilityListing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.SETTLED },
    });

    // Trigger immediate zero-latency payload migration to private storage
    migratePayload(listing.id).catch((err) =>
      console.error('[EscrowController] Immediate payload migration error:', err)
    );

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
            role: true,
          },
        },
      },
    });

    const user = (req as any).user;

    if (!escrow) {
      // Check if listing exists without escrow record yet
      const listing = await prisma.vulnerabilityListing.findFirst({
        where: {
          OR: [{ id: id }, { merkle_root: id }],
        },
      });

      if (listing) {
        const canViewAll = user && (user.role === 'ADMIN' || listing.seller_id === user.id);
        const sanitizedListingClaims = canViewAll
          ? listing.claims
          : Array.isArray(listing.claims)
          ? (listing.claims as any[])
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
              }))
          : [];

        const sanitizedListing = {
          ...listing,
          claims: sanitizedListingClaims,
        };

        return res.json({
          escrow: null,
          status: listing.status,
          listing: sanitizedListing,
        });
      }

      return res.status(404).json({ error: 'Escrow transaction not found' });
    }

    const isSeller = user && escrow.listing.seller_id === user.id;
    const isAdmin = user && user.role === 'ADMIN';
    const isBuyer = Boolean(
      user && (
        escrow.buyer_id === user.id ||
        (user.wallet_address && escrow.buyer?.wallet_address && user.wallet_address.toLowerCase() === escrow.buyer.wallet_address.toLowerCase()) ||
        (user.wallet_address && escrow.listing.vendor_address && user.wallet_address.toLowerCase() === escrow.listing.vendor_address.toLowerCase())
      )
    );
    const isSettled = escrow.status === ListingStatus.SETTLED || escrow.listing.status === ListingStatus.SETTLED;
    const isSettledBuyer = isBuyer && isSettled;
    const canViewAllClaims = isSeller || isAdmin || isSettledBuyer;
    const canViewDecryptionKey = isSeller || isAdmin || isSettledBuyer;

    // Sanitize unauthorized access to decryption keys and hidden claims (enforce immutability)
    let sanitizedClaims: any = [];
    if (canViewAllClaims) {
      sanitizedClaims = escrow.listing.claims;
    } else if (Array.isArray(escrow.listing.claims)) {
      sanitizedClaims = (escrow.listing.claims as any[])
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
    }

    const sanitizedListing = {
      ...escrow.listing,
      claims: sanitizedClaims,
    };

    const sanitizedEscrow = {
      ...escrow,
      decryption_key: canViewDecryptionKey ? escrow.decryption_key : null,
      listing: sanitizedListing,
    };

    return res.json({
      escrow: sanitizedEscrow,
      status: escrow.status,
      tx_hash_fund: escrow.tx_hash_fund,
      tx_hash_settle: escrow.tx_hash_settle,
      contract_address: escrow.contract_address,
      bounty_locked_at: escrow.bounty_locked_at,
      listing: sanitizedListing,
      buyer: escrow.buyer,
    });
  } catch (error) {
    console.error('[EscrowController] getEscrowStatus error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
