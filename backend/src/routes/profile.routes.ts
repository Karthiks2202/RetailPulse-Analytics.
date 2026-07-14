import { Router } from 'express';
import { getProfile, changePassword } from '../controllers/profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';

const router = Router();

router.get('/me', authenticateJWT, getProfile);
router.post(
  '/change-password',
  authenticateJWT,
  validateBody(['currentPassword', 'newPassword']),
  changePassword
);

export default router;
