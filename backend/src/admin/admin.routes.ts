import { Router } from 'express';
import { updateBuyerKYC } from './admin.controller';
import { requireAuth, requireRole, doubleCsrfProtection } from '../auth/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Update buyer KYC status directly in database (requires ADMIN role and CSRF validation)
router.post('/buyers/:id/kyc', requireAuth, doubleCsrfProtection, requireRole([Role.ADMIN]), updateBuyerKYC);

export default router;

