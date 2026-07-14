import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const checkCompanyAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Super Admin bypasses company tenant checks
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Read target company id from params, query, or request body
  const targetCompanyId = req.params.companyId || req.query.companyId || req.body.companyId;

  if (targetCompanyId && targetCompanyId !== req.user.companyId) {
    return res.status(403).json({ error: 'Access denied: Resource belongs to another company' });
  }

  next();
};
