import { Router } from 'express';
import { fundEscrow, revealEscrow, getEscrowStatus } from '../controllers/escrow.controller';
import { requireAuth, doubleCsrfProtection } from '../auth/auth.middleware';

const router = Router();

// All escrow endpoints require authentication
router.use(requireAuth);

router.post('/fund', doubleCsrfProtection, fundEscrow);
router.post('/reveal', doubleCsrfProtection, revealEscrow);
router.get('/:id', getEscrowStatus);

export default router;
