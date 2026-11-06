import { Router } from 'express';
import { fundEscrow, revealEscrow, getEscrowStatus } from '../controllers/escrow.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// All escrow endpoints require authentication
router.use(requireAuth);

router.post('/fund', fundEscrow);
router.post('/reveal', revealEscrow);
router.get('/:id', getEscrowStatus);

export default router;
