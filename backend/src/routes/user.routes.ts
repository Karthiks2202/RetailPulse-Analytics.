import { Router } from 'express';
import { listUsers } from '../controllers/user.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Restrict listing users to admins
router.get('/', authenticateJWT, requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']), listUsers);

export default router;
