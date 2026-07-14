import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { AuditService } from '../services/audit.service';

// Helpers to issue tokens
const generateAccessToken = (user: { id: string; email: string; role: string; companyId: string }) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as any }
  );
};

const generateRefreshToken = (user: { id: string }) => {
  return jwt.sign(
    { 
      id: user.id,
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36)
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY as any }
  );
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  const {
    companyName,
    industry,
    companyEmail,
    companyAddress,
    companyPhone,
    ownerName,
    ownerEmail,
    password,
    confirmPassword,
  } = req.body;

  try {
    // 1. Validations
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check unique emails
    const existingCompany = await prisma.company.findUnique({
      where: { email: companyEmail },
    });
    if (existingCompany) {
      return res.status(400).json({ error: 'Company email is already registered' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User email is already registered' });
    }

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Database transaction to create Company and Admin User atomically
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          industry,
          email: companyEmail,
          address: companyAddress,
          phone: companyPhone,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          name: ownerName,
          email: ownerEmail,
          password: hashedPassword,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        },
      });

      return { company, user };
    });

    // 4. Create Audit Log
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Unknown';
    const browser = req.headers['user-agent'] || 'Unknown';

    await AuditService.log({
      companyId: result.company.id,
      userId: result.user.id,
      action: 'Company Registered',
      ipAddress,
      browser,
    });

    return res.status(201).json({
      message: 'Company and Admin user registered successfully',
      company: {
        id: result.company.id,
        name: result.company.name,
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to db
    const jwtPayload = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(jwtPayload.exp * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    // Update lastLogin timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Write audit log
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Unknown';
    const browser = req.headers['user-agent'] || 'Unknown';

    await AuditService.log({
      companyId: user.companyId,
      userId: user.id,
      action: 'User Login',
      ipAddress,
      browser,
    });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company.name,
        companyId: user.companyId,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    // 1. Verify token
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };

    // 2. Check db record
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      return res.status(401).json({ error: 'Refresh token expired or invalid' });
    }

    const { user } = storedToken;

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // 3. Issue new tokens (Token Rotation)
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // 4. Update refresh token in db (delete old, save new)
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: storedToken.id } }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt: new Date((jwt.decode(newRefreshToken) as { exp: number }).exp * 1000),
        },
      }),
    ]);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (storedToken) {
        await prisma.refreshToken.delete({
          where: { id: storedToken.id },
        });

        // Audit log
        const user = await prisma.user.findUnique({
          where: { id: storedToken.userId },
        });

        if (user) {
          const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Unknown';
          const browser = req.headers['user-agent'] || 'Unknown';

          await AuditService.log({
            companyId: user.companyId,
            userId: user.id,
            action: 'User Logout',
            ipAddress,
            browser,
          });
        }
      }
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};
