import { Router, Request, Response, NextFunction } from 'express';
import {
  createListing,
  getListings,
  getListingById,
  commitListing,
  fundEscrow,
  settleEscrow,
  downloadPayload,
  expireEscrow,
  reclaimEscrow,
} from './listings.controller';
import { requireAuth, requireRole, doubleCsrfProtection } from '../auth/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// ─── Public routes (read-only) ──────────────────────────────────────
router.get('/', getListings);
router.get('/:id', getListingById);

// ─── Protected routes (require authentication) ─────────────────────
// All state-changing operations require authentication
router.post('/', requireAuth, doubleCsrfProtection, requireRole([Role.RESEARCHER]), createListing);
router.post('/:id/commit', requireAuth, doubleCsrfProtection, commitListing);
router.post('/:id/fund', requireAuth, doubleCsrfProtection, fundEscrow);
router.post('/:id/settle', requireAuth, doubleCsrfProtection, settleEscrow);
router.post('/:id/expire', requireAuth, doubleCsrfProtection, expireEscrow);
router.post('/:id/reclaim', requireAuth, doubleCsrfProtection, reclaimEscrow);
router.get('/:id/payload', requireAuth, downloadPayload);

export default router;
