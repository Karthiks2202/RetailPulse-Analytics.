import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation.middleware';

const router = Router();

router.post(
  '/register',
  validateBody([
    'companyName',
    'industry',
    'companyEmail',
    'companyAddress',
    'companyPhone',
    'ownerName',
    'ownerEmail',
    'password',
    'confirmPassword',
  ]),
  register
);

router.post('/login', validateBody(['email', 'password']), login);
router.post('/refresh', validateBody(['refreshToken']), refresh);
router.post('/logout', logout);

export default router;
