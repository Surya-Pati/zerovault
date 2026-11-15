process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me_in_prod_test_min_32_chars';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'csrfsecret_min16chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { handleContractEvent, Web3BridgeService } from '../services/bridge';
import { ListingStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET;

// Generate valid session token for testing authenticated endpoints
const validToken = jwt.sign(
  { userId: 'user-123', role: 'BUYER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const sellerToken = jwt.sign(
  { userId: 'seller-456', role: 'BUYER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const unverifiedToken = jwt.sign(
  { userId: 'unverified-789', role: 'BUYER' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const buyerCookie = `session=${validToken}`;
const sellerCookie = `session=${sellerToken}`;
const unverifiedBuyerCookie = `session=${unverifiedToken}`;

async function getCsrfForSession(sessionCookie: string) {
  const res = await request(app)
    .get('/api/auth/csrf-token')
    .set('Cookie', [sessionCookie]);
  const token = res.body.csrfToken;
  const rawCookies = res.headers['set-cookie'];
  const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : (typeof rawCookies === 'string' ? [rawCookies] : []);
  const csrfCookie = cookies.find((c: string) => c.startsWith('x-csrf-token=')) || '';
  return { token, csrfCookie };
}

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockUser = {
    id: 'user-123',
    email: 'buyer@zerovault.io',
    role: 'BUYER',
    verified_buyer: true,
  };

  const mockSeller = {
    id: 'seller-456',
    email: 'seller@zerovault.io',
    role: 'BUYER',
    verified_buyer: true,
  };

  const mockUnverifiedUser = {
    id: 'unverified-789',
    email: 'unverified@zerovault.io',
    role: 'BUYER',
    verified_buyer: false,
  };

  const mockListing = {
    id: 'listing-123',
    seller_id: 'seller-456',
    title: 'Critical RCE Vulnerability',
    category: 'RCE',
    severity: 'CRITICAL',
    merkle_root: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    price_wei: '1000000000000000000',
    status: 'COMMITTED',
    created_at: new Date(),
  };

  const mockUnfundedListing = {
    id: 'listing-unfunded',
    seller_id: 'seller-456',
    title: 'Unfunded Listing',
    category: 'RCE',
    severity: 'HIGH',
    merkle_root: '0xunfunded1111111111111111111111111111111111111111111111111111111111',
    price_wei: '1000000000000000000',
    status: 'COMMITTED',
    created_at: new Date(),
  };

  const mockEscrow = {
    id: 'escrow-123',
    listing_id: 'listing-123',
    buyer_id: 'user-123',
    contract_address: '0x0000000000000000000000000000000000000000',
    tx_hash_fund: '0xfund123',
    tx_hash_settle: null,
    status: 'BOUNTY_LOCKED',
    bounty_locked_at: new Date(),
    listing: mockListing,
    buyer: mockUser,
  };

  const mockUnfundedEscrow = {
    id: 'escrow-unfunded',
    listing_id: 'listing-unfunded',
    buyer_id: 'user-123',
    contract_address: '0x0000000000000000000000000000000000000000',
    tx_hash_fund: null,
    tx_hash_settle: null,
    status: 'COMMITTED',
    bounty_locked_at: null,
    listing: mockUnfundedListing,
    buyer: mockUser,
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-123') return Promise.resolve(mockUser);
          if (where.id === 'seller-456') return Promise.resolve(mockSeller);
          if (where.id === 'unverified-789') return Promise.resolve(mockUnverifiedUser);
          return Promise.resolve(null);
        }),
      },
      vulnerabilityListing: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'listing-123') return Promise.resolve(mockListing);
          if (where.id === 'listing-unfunded') return Promise.resolve(mockUnfundedListing);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (
            where.id === 'listing-123' ||
            where.merkle_root === mockListing.merkle_root ||
            (where.OR &&
              where.OR.some(
                (o: any) =>
                  o.id === 'listing-123' || o.merkle_root === mockListing.merkle_root
              ))
          ) {
            return Promise.resolve(mockListing);
          }
          if (
            where.id === 'listing-unfunded' ||
            where.merkle_root === mockUnfundedListing.merkle_root ||
            (where.OR &&
              where.OR.some(
                (o: any) =>
                  o.id === 'listing-unfunded' || o.merkle_root === mockUnfundedListing.merkle_root
              ))
          ) {
            return Promise.resolve(mockUnfundedListing);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({ ...mockListing, ...data });
        }),
      },
      escrowTransaction: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (
            where.id === 'escrow-123' ||
            where.listing_id === 'listing-123' ||
            (where.OR &&
              where.OR.some(
                (o: any) =>
                  o.id === 'escrow-123' ||
                  o.listing_id === 'listing-123' ||
                  (o.listing && o.listing.merkle_root === mockListing.merkle_root)
              ))
          ) {
            return Promise.resolve(mockEscrow);
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.listing_id === 'listing-123') return Promise.resolve(mockEscrow);
          if (where.listing_id === 'listing-unfunded') return Promise.resolve(mockUnfundedEscrow);
          return Promise.resolve(null);
        }),
        upsert: jest.fn().mockImplementation(({ update, create }) => {
          return Promise.resolve({ ...mockEscrow, ...update });
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({ ...mockEscrow, ...data });
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ id: 'escrow-new', ...data });
        }),
      },
    })),
    Role: {
      RESEARCHER: 'RESEARCHER',
      BUYER: 'BUYER',
      ADMIN: 'ADMIN',
    },
    ListingStatus: {
      COMMITTED: 'COMMITTED',
      BOUNTY_LOCKED: 'BOUNTY_LOCKED',
      SETTLED: 'SETTLED',
      EXPIRED: 'EXPIRED',
      REFUNDED: 'REFUNDED',
    },
  };
});

describe('Module 4: API Gateway & Web3 Bridge Tests', () => {
  describe('POST /api/escrow/fund', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app)
        .post('/api/escrow/fund')
        .send({ listing_id: 'listing-123', tx_hash: '0xfund123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('should return 403 when CSRF token is missing', async () => {
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('Cookie', [buyerCookie])
        .send({ listing_id: 'listing-123', tx_hash: '0xfund123' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when missing listing_id or tx_hash (Zod validation)', async () => {
      const { token, csrfCookie } = await getCsrfForSession(buyerCookie);
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, buyerCookie])
        .send({ listing_id: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 404 when listing does not exist', async () => {
      const { token, csrfCookie } = await getCsrfForSession(buyerCookie);
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, buyerCookie])
        .send({ listing_id: 'non-existent-listing', tx_hash: '0xfund123' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vulnerability listing not found');
    });

    it('should return 403 when seller attempts to fund own listing', async () => {
      const { token, csrfCookie } = await getCsrfForSession(sellerCookie);
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, sellerCookie])
        .send({ listing_id: 'listing-123', tx_hash: '0xfund123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Cannot fund your own listing');
    });

    it('should return 403 when unverified buyer attempts to fund escrow', async () => {
      const { token, csrfCookie } = await getCsrfForSession(unverifiedBuyerCookie);
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, unverifiedBuyerCookie])
        .send({ listing_id: 'listing-123', tx_hash: '0xfund123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only admin-verified buyers can fund escrows');
    });

    it('should update escrow state and return 200 on valid funding request', async () => {
      const { token, csrfCookie } = await getCsrfForSession(buyerCookie);
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, buyerCookie])
        .send({ listing_id: 'listing-123', tx_hash: '0xfund123' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Escrow funded successfully');
      expect(res.body.escrow).toBeDefined();
      expect(res.body.escrow.status).toBe(ListingStatus.BOUNTY_LOCKED);
      expect(res.body.listing.status).toBe(ListingStatus.BOUNTY_LOCKED);
    });
  });

  describe('POST /api/escrow/reveal', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app)
        .post('/api/escrow/reveal')
        .send({ decryptionKey: 'secret_key_123', merkleRoot: '0x123' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when CSRF token is missing', async () => {
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('Cookie', [sellerCookie])
        .send({ decryptionKey: 'secret_key_123', merkleRoot: '0x123' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when decryptionKey or merkleRoot is missing (Zod validation)', async () => {
      const { token, csrfCookie } = await getCsrfForSession(sellerCookie);
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, sellerCookie])
        .send({ decryptionKey: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 400 when attempting to reveal an escrow that is not funded', async () => {
      const { token, csrfCookie } = await getCsrfForSession(sellerCookie);
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, sellerCookie])
        .send({
          decryptionKey: 'aes_secret_key_999',
          merkleRoot: '0xunfunded1111111111111111111111111111111111111111111111111111111111',
          tx_hash_settle: '0xsettle999',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('escrow must be funded first');
    });

    it('should update escrow and listing state to SETTLED on valid reveal request', async () => {
      const { token, csrfCookie } = await getCsrfForSession(sellerCookie);
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('x-csrf-token', token)
        .set('Cookie', [csrfCookie, sellerCookie])
        .send({
          decryptionKey: 'aes_secret_key_999',
          merkleRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          tx_hash_settle: '0xsettle999',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('settled successfully');
      expect(res.body.escrow.status).toBe(ListingStatus.SETTLED);
      expect(res.body.listing.status).toBe(ListingStatus.SETTLED);
    });
  });

  describe('GET /api/escrow/:id', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app).get('/api/escrow/escrow-123');
      expect(res.status).toBe(401);
    });

    it('should return escrow status and details for existing escrow ID', async () => {
      const res = await request(app)
        .get('/api/escrow/escrow-123')
        .set('Cookie', [`session=${validToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.escrow).toBeDefined();
      expect(res.body.status).toBeDefined();
      expect(res.body.listing).toBeDefined();
    });

    it('should return 404 for unknown escrow ID', async () => {
      const res = await request(app)
        .get('/api/escrow/unknown-id')
        .set('Cookie', [`session=${validToken}`]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Escrow transaction not found');
    });
  });

  describe('Web3 Bridge Service & Event Handler Tests', () => {
    const testMerkleRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should process BountyLocked event and set status to BOUNTY_LOCKED', async () => {
      const result = await handleContractEvent('BountyLocked', testMerkleRoot, {
        amount: BigInt(100000),
      });

      expect(result).toBeDefined();
      expect(result?.listing.status).toBe(ListingStatus.BOUNTY_LOCKED);
      expect(result?.escrow.status).toBe(ListingStatus.BOUNTY_LOCKED);
    });

    it('should process SettlementConfirmed event and set status to SETTLED', async () => {
      const result = await handleContractEvent('SettlementConfirmed', testMerkleRoot, {
        decryptionKey: 'key123',
      });

      expect(result).toBeDefined();
      expect(result?.listing.status).toBe(ListingStatus.SETTLED);
      expect(result?.escrow.status).toBe(ListingStatus.SETTLED);
    });

    it('should process VaultExpired event and set status to EXPIRED', async () => {
      const result = await handleContractEvent('VaultExpired', testMerkleRoot);

      expect(result).toBeDefined();
      expect(result?.listing.status).toBe(ListingStatus.EXPIRED);
      expect(result?.escrow.status).toBe(ListingStatus.EXPIRED);
    });

    it('should process BountyReclaimed event and set status to REFUNDED', async () => {
      const result = await handleContractEvent('BountyReclaimed', testMerkleRoot);

      expect(result).toBeDefined();
      expect(result?.listing.status).toBe(ListingStatus.REFUNDED);
      expect(result?.escrow.status).toBe(ListingStatus.REFUNDED);
    });

    it('should handle connection failure and increment retry count in Web3BridgeService', () => {
      const bridge = new Web3BridgeService({
        rpcUrl: 'http://invalid-rpc-address:9999',
        contractAddress: '0x1234567890123456789012345678901234567890',
        retryDelayMs: 10,
        maxRetries: 3,
      });

      expect(bridge.isListening()).toBe(false);
      expect(bridge.getRetryCount()).toBe(0);

      bridge.handleConnectionFailure();
      expect(bridge.getRetryCount()).toBe(1);

      bridge.stop();
      expect(bridge.isListening()).toBe(false);
    });
  });
});
