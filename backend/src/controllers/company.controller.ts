import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export const getCompanyDetails = async (req: Request, res: Response, next: NextFunction) => {
  const { companyId } = req.params;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json(company);
  } catch (error) {
    next(error);
  }
};
