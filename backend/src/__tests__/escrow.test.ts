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

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockUser = {
    id: 'user-123',
    email: 'buyer@zerovault.io',
    role: 'BUYER',
    verified_buyer: true,
  };

  const mockListing = {
    id: 'listing-123',
    seller_id: 'user-123',
    title: 'Critical RCE Vulnerability',
    category: 'RCE',
    severity: 'CRITICAL',
    merkle_root: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
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

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-123') return Promise.resolve(mockUser);
          return Promise.resolve(null);
        }),
      },
      vulnerabilityListing: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'listing-123') return Promise.resolve(mockListing);
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

    it('should return 400 when missing listing_id or tx_hash (Zod validation)', async () => {
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('Cookie', [`session=${validToken}`])
        .send({ listing_id: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should return 404 when listing does not exist', async () => {
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('Cookie', [`session=${validToken}`])
        .send({ listing_id: 'non-existent-listing', tx_hash: '0xfund123' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vulnerability listing not found');
    });

    it('should update escrow state and return 200 on valid funding request', async () => {
      const res = await request(app)
        .post('/api/escrow/fund')
        .set('Cookie', [`session=${validToken}`])
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

    it('should return 400 when decryptionKey or merkleRoot is missing (Zod validation)', async () => {
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('Cookie', [`session=${validToken}`])
        .send({ decryptionKey: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should update escrow and listing state to SETTLED on valid reveal request', async () => {
      const res = await request(app)
        .post('/api/escrow/reveal')
        .set('Cookie', [`session=${validToken}`])
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
