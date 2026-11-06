import { Router } from 'express';
import { getNonce, verifySiwe, logout, getCsrfToken, getMe, getBuyers } from './auth.controller';
import { doubleCsrfProtection } from './auth.middleware';

const router = Router();

// CSRF token route (must not be protected by CSRF itself)
router.get('/csrf-token', getCsrfToken);

// SIWE Nonce
router.get('/nonce', getNonce);

// Logout (does not need CSRF protection)
router.get('/logout', logout);

// Protected by CSRF
router.use(doubleCsrfProtection);

router.post('/verify-siwe', verifySiwe);

// Protected by requireAuth
import { requireAuth, requireRole } from './auth.middleware';
import { Role } from '@prisma/client';
router.get('/me', requireAuth, getMe);
router.get('/buyers', requireAuth, requireRole([Role.ADMIN, Role.RESEARCHER]), getBuyers);

export default router;
