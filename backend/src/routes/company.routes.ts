import { Router } from 'express';
import { getCompanyDetails } from '../controllers/company.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { checkCompanyAccess } from '../middleware/company.middleware';

const router = Router();

router.get('/:companyId', authenticateJWT, checkCompanyAccess, getCompanyDetails);

export default router;
