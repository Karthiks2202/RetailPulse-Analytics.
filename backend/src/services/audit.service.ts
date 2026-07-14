import { prisma } from '../config/database';

export interface AuditLogPayload {
  companyId: string;
  userId: string | null;
  action: string;
  ipAddress: string;
  browser: string;
}

export class AuditService {
  static async log({ companyId, userId, action, ipAddress, browser }: AuditLogPayload) {
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId,
          action,
          ipAddress: ipAddress || 'Unknown',
          browser: browser || 'Unknown',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('[AuditService Error]: Failed to persist audit log:', error);
    }
  }
}
