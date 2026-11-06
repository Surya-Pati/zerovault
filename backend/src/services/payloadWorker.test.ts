import fs from 'fs';
import path from 'path';
import {
  migratePayload,
  processSettledListings,
  ensureStorageDirectories,
  PUBLIC_STORAGE_DIR,
  PRIVATE_STORAGE_DIR,
} from './payloadWorker';
import { PrismaClient, ListingStatus } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    vulnerabilityListing: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    ListingStatus: {
      COMMITTED: 'COMMITTED',
      BOUNTY_LOCKED: 'BOUNTY_LOCKED',
      SETTLED: 'SETTLED',
      EXPIRED: 'EXPIRED',
      REFUNDED: 'REFUNDED',
    },
  };
});

describe('PayloadWorker Service (Module 6 Background Migration)', () => {
  let prismaMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    ensureStorageDirectories();
    prismaMock = new PrismaClient();
  });

  afterEach(() => {
    // Cleanup temporary test files
    const testFiles = ['test-settled-1.enc', 'test-committed-2.enc'];
    for (const file of testFiles) {
      const pubPath = path.join(PUBLIC_STORAGE_DIR, file);
      const privPath = path.join(PRIVATE_STORAGE_DIR, file);
      if (fs.existsSync(pubPath)) fs.unlinkSync(pubPath);
      if (fs.existsSync(privPath)) fs.unlinkSync(privPath);
    }
  });

  test('ensureStorageDirectories creates public and private storage folders', () => {
    ensureStorageDirectories();
    expect(fs.existsSync(PUBLIC_STORAGE_DIR)).toBe(true);
    expect(fs.existsSync(PRIVATE_STORAGE_DIR)).toBe(true);
  });

  test('should migrate payload file from public to private storage for SETTLED listing and delete public file', async () => {
    const listingId = 'test-settled-1';
    const filename = `${listingId}.enc`;
    const publicFilePath = path.join(PUBLIC_STORAGE_DIR, filename);
    const privateFilePath = path.join(PRIVATE_STORAGE_DIR, filename);

    // Create mock public encrypted file
    fs.writeFileSync(publicFilePath, 'ENCRYPTED_CIPHERTEXT_BLOB_TEST_DATA');
    expect(fs.existsSync(publicFilePath)).toBe(true);

    prismaMock.vulnerabilityListing.findUnique.mockResolvedValue({
      id: listingId,
      status: ListingStatus.SETTLED,
      encrypted_payload_uri: `storage/public/${filename}`,
    });

    prismaMock.vulnerabilityListing.update.mockResolvedValue({
      id: listingId,
      status: ListingStatus.SETTLED,
      encrypted_payload_uri: `storage/private/${filename}`,
    });

    const success = await migratePayload(listingId);

    expect(success).toBe(true);
    // Public file should be deleted
    expect(fs.existsSync(publicFilePath)).toBe(false);
    // Private file should exist with exact payload contents
    expect(fs.existsSync(privateFilePath)).toBe(true);
    const content = fs.readFileSync(privateFilePath, 'utf-8');
    expect(content).toBe('ENCRYPTED_CIPHERTEXT_BLOB_TEST_DATA');

    // DB record should be updated to point to private path
    expect(prismaMock.vulnerabilityListing.update).toHaveBeenCalledWith({
      where: { id: listingId },
      data: {
        encrypted_payload_uri: expect.stringContaining('storage/private'),
      },
    });
  });

  test('should NOT migrate payload file if listing status is not SETTLED', async () => {
    const listingId = 'test-committed-2';
    const filename = `${listingId}.enc`;
    const publicFilePath = path.join(PUBLIC_STORAGE_DIR, filename);
    const privateFilePath = path.join(PRIVATE_STORAGE_DIR, filename);

    fs.writeFileSync(publicFilePath, 'COMMITTED_PAYLOAD_UNSETTLED');

    prismaMock.vulnerabilityListing.findUnique.mockResolvedValue({
      id: listingId,
      status: ListingStatus.COMMITTED,
      encrypted_payload_uri: `storage/public/${filename}`,
    });

    const success = await migratePayload(listingId);

    expect(success).toBe(false);
    // File should remain in public storage
    expect(fs.existsSync(publicFilePath)).toBe(true);
    expect(fs.existsSync(privateFilePath)).toBe(false);
    expect(prismaMock.vulnerabilityListing.update).not.toHaveBeenCalled();
  });

  test('processSettledListings sweeps all SETTLED listings', async () => {
    const listingId = 'test-settled-1';
    const filename = `${listingId}.enc`;
    const publicFilePath = path.join(PUBLIC_STORAGE_DIR, filename);

    fs.writeFileSync(publicFilePath, 'SWEEP_TEST_PAYLOAD');

    prismaMock.vulnerabilityListing.findMany.mockResolvedValue([
      {
        id: listingId,
        status: ListingStatus.SETTLED,
        encrypted_payload_uri: `storage/public/${filename}`,
      },
    ]);

    prismaMock.vulnerabilityListing.findUnique.mockResolvedValue({
      id: listingId,
      status: ListingStatus.SETTLED,
      encrypted_payload_uri: `storage/public/${filename}`,
    });

    prismaMock.vulnerabilityListing.update.mockResolvedValue({});

    const count = await processSettledListings();

    expect(count).toBe(1);
    expect(prismaMock.vulnerabilityListing.findMany).toHaveBeenCalledWith({
      where: { status: ListingStatus.SETTLED },
    });
  });
});
