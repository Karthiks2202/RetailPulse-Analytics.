import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const listUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Enforce company-level isolation: only SUPER_ADMIN may see users across
    // all companies; COMPANY_ADMIN is scoped to its own company.
    const where =
      req.user.role === 'SUPER_ADMIN' ? {} : { companyId: req.user.companyId };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return res.json(users);
  } catch (error) {
    next(error);
  }
};
