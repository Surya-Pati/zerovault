process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecret_change_me_in_prod_test_min_32_chars';
process.env.CSRF_SECRET = process.env.CSRF_SECRET || 'csrfsecret_min16chars';
process.env.ZEROVAULT_CONTRACT_ADDRESS = process.env.ZEROVAULT_CONTRACT_ADDRESS || '0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/auth.middleware';
import { JsonRpcProvider, Interface, keccak256, toUtf8Bytes } from 'ethers';
import path from 'path';
import fs from 'fs';

const rawKeyHex = '51817fde805258957d8b68186c708b11ac91c5ddb134e031086afb9063229fea';
const keyHash = keccak256(toUtf8Bytes(rawKeyHex)).toLowerCase();
const merkleRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const FUND_TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';
const SETTLE_TX_HASH = '0x2222222222222222222222222222222222222222222222222222222222222222';

const mockResearcher = {
  id: 'researcher-123',
  wallet_address: '0x1111111111111111111111111111111111111111',
  role: 'RESEARCHER',
  profile_name: 'TestResearcher',
};

const mockBuyer = {
  id: 'buyer-123',
  wallet_address: '0x2222222222222222222222222222222222222222',
  role: 'BUYER',
  verified_buyer: true,
  profile_name: 'TestBuyer',
};

let inMemoryListing: any = null;
let inMemoryEscrow: any = null;

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'researcher-123') return Promise.resolve(mockResearcher);
          if (where.id === 'buyer-123') return Promise.resolve(mockBuyer);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
      },
      vulnerabilityListing: {
        create: jest.fn().mockImplementation(({ data }) => {
          inMemoryListing = {
            id: 'listing-test-uuid',
            status: 'CREATED',
            created_at: new Date(),
            escrow: null,
            key_hash: keyHash,
            ...data,
          };
          return Promise.resolve(inMemoryListing);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (inMemoryListing && inMemoryListing.id === where.id) {
            return Promise.resolve({
              ...inMemoryListing,
              escrow: inMemoryEscrow,
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (inMemoryListing && inMemoryListing.id === where.id) {
            inMemoryListing = { ...inMemoryListing, ...data };
            return Promise.resolve({
              ...inMemoryListing,
              escrow: inMemoryEscrow,
            });
          }
          return Promise.resolve(null);
        }),
      },
      escrowTransaction: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(inMemoryEscrow)),
        create: jest.fn().mockImplementation(({ data }) => {
          inMemoryEscrow = {
            id: 'escrow-test-uuid',
            status: 'BOUNTY_LOCKED',
            bounty_locked_at: new Date(),
            ...data,
          };
          return Promise.resolve(inMemoryEscrow);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          inMemoryEscrow = { ...inMemoryEscrow, ...data };
          return Promise.resolve(inMemoryEscrow);
        }),
        upsert: jest.fn().mockImplementation(({ update, create }) => {
          if (inMemoryEscrow) {
            inMemoryEscrow = { ...inMemoryEscrow, ...update };
          } else {
            inMemoryEscrow = { id: 'escrow-test-uuid', ...create };
          }
          return Promise.resolve(inMemoryEscrow);
        }),
      },
    })),
    Role: {
      RESEARCHER: 'RESEARCHER',
      BUYER: 'BUYER',
      ADMIN: 'ADMIN',
    },
    ListingStatus: {
      CREATED: 'CREATED',
      COMMITTED: 'COMMITTED',
      BOUNTY_LOCKED: 'BOUNTY_LOCKED',
      SETTLED: 'SETTLED',
      EXPIRED: 'EXPIRED',
      REFUNDED: 'REFUNDED',
    },
  };
});

import app from '../app';

describe('ZeroVault Backend Integration Tests', () => {
  let listingId: string;

  const researcherToken = jwt.sign({ userId: 'researcher-123', role: 'RESEARCHER' }, JWT_SECRET, { expiresIn: '1h' });
  const buyerToken = jwt.sign({ userId: 'buyer-123', role: 'BUYER' }, JWT_SECRET, { expiresIn: '1h' });

  const researcherCookie = `session=${researcherToken}`;
  const buyerCookie = `session=${buyerToken}`;

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

  beforeAll(() => {
    const iface = new Interface([
      'event BountyLocked(bytes32 indexed merkleRoot, uint256 amount)',
      'event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash, bytes encryptedKey)',
    ]);

    const contractAddress = process.env.ZEROVAULT_CONTRACT_ADDRESS || '0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091';

    jest.spyOn(JsonRpcProvider.prototype, 'getTransactionReceipt').mockImplementation(async (hash: string): Promise<any> => {
      if (hash === FUND_TX_HASH) {
        const log = iface.encodeEventLog(iface.getEvent('BountyLocked')!, [
          merkleRoot,
          BigInt('1000000000000000000'),
        ]);
        return {
          status: 1,
          to: contractAddress,
          logs: [{ ...log, address: contractAddress }],
        };
      }
      if (hash === SETTLE_TX_HASH) {
        const mockEncryptedKey = '0x' + 'aa'.repeat(93);
        const log = iface.encodeEventLog(iface.getEvent('SettlementConfirmed')!, [
          merkleRoot,
          keyHash,
          mockEncryptedKey,
        ]);
        return {
          status: 1,
          to: contractAddress,
          logs: [{ ...log, address: contractAddress }],
        };
      }
      return null;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
    if (listingId) {
      const p = path.join(__dirname, '../../storage/public', `${listingId}.enc`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  });

  it('GET /api/health should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/auth/csrf-token should return a CSRF token and set cookie', async () => {
    const res = await request(app).get('/api/auth/csrf-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrfToken');
  });

  it('GET /api/auth/nonce should return SIWE nonce text', async () => {
    const res = await request(app).get('/api/auth/nonce');
    expect(res.status).toBe(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(8);
  });

  it('POST /api/listings should create a new vulnerability listing', async () => {
    const { token, csrfCookie } = await getCsrfForSession(researcherCookie);

    const res = await request(app)
      .post('/api/listings')
      .set('x-csrf-token', token)
      .set('Cookie', [csrfCookie, researcherCookie])
      .send({
        title: 'Critical Buffer Overflow in Linux Kernel',
        category: 'Kernel',
        severity: 'CRITICAL',
        price_wei: '1000000000000000000',
        claims: {
          cve: 'CVE-2026-9999',
          target: 'Linux Kernel 6.8',
          impact: 'Remote Code Execution',
        },
        ciphertext: 'base64EncodedCiphertextPayload==',
        iv: '0123456789abcdef01234567',
        keyHash: keyHash,
        merkleRoot: merkleRoot,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.listing).toHaveProperty('id');
    expect(res.body.listing).toHaveProperty('merkle_root');
    expect(res.body.listing.merkle_root).toBe(merkleRoot);

    listingId = res.body.listing.id;
  });

  it('GET /api/listings/:id should return listing details', async () => {
    const res = await request(app).get(`/api/listings/${listingId}`);
    expect(res.status).toBe(200);
    expect(res.body.listing.id).toBe(listingId);
    expect(res.body.listing.status).toBe('CREATED');
  });

  it('POST /api/listings/:id/fund should transition listing status to BOUNTY_LOCKED', async () => {
    const { token, csrfCookie } = await getCsrfForSession(buyerCookie);

    const res = await request(app)
      .post(`/api/listings/${listingId}/fund`)
      .set('x-csrf-token', token)
      .set('Cookie', [csrfCookie, buyerCookie])
      .send({
        contract_address: process.env.ZEROVAULT_CONTRACT_ADDRESS || '0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091',
        tx_hash_fund: FUND_TX_HASH,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.listing.status).toBe('BOUNTY_LOCKED');
  });

  it('POST /api/listings/:id/settle should transition listing status to SETTLED', async () => {
    const { token, csrfCookie } = await getCsrfForSession(researcherCookie);

    const res = await request(app)
      .post(`/api/listings/${listingId}/settle`)
      .set('x-csrf-token', token)
      .set('Cookie', [csrfCookie, researcherCookie])
      .send({
        tx_hash_settle: SETTLE_TX_HASH,
        decryptionKey: rawKeyHex,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.listing.status).toBe('SETTLED');
  });

  it('GET /api/listings/:id/payload should allow downloading private payload', async () => {
    const res = await request(app)
      .get(`/api/listings/${listingId}/payload`)
      .set('Cookie', [buyerCookie]);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/octet-stream');
  });
});
