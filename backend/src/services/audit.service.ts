import { v4 as uuidv4 } from 'uuid';
import { AuditLog, IAuditLog } from '../models/audit-log.model';

export interface LogActionParams {
  actor: {
    userId: string;
    role: string;
    email?: string;
  };
  action: string;
  entityType: string;
  entityId: string;
  httpMethod?: string;
  path?: string;
  resultStatus?: 'SUCCESS' | 'FAILURE';
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  previousState?: Record<string, any>;
  changedState?: Record<string, any>;
}

export class AuditService {
  /**
   * Sanitizes object by removing sensitive fields (passwords, JWTs, keys, PII, contacts, evidence paths)
   */
  private sanitize(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item));
    }

    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'jwt',
      'secret',
      'encryptionKey',
      'contactData',
      'complainantContact',
      'decryptedContact',
      'evidencePath',
      'authTag',
      'iv'
    ];

    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        clean[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        clean[key] = this.sanitize(obj[key]);
      } else {
        clean[key] = obj[key];
      }
    }
    return clean;
  }

  /**
   * Safely logs an action without throwing exceptions to caller
   */
  async logAction(params: LogActionParams): Promise<IAuditLog | null> {
    try {
      const auditLog = new AuditLog({
        auditId: `AUD-${uuidv4().substring(0, 8).toUpperCase()}`,
        timestamp: new Date(),
        actor: {
          userId: params.actor.userId,
          role: params.actor.role,
          email: params.actor.email
        },
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        httpMethod: params.httpMethod,
        path: params.path,
        resultStatus: params.resultStatus || 'SUCCESS',
        metadata: this.sanitize(params.metadata),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        previousStateSummary: this.sanitize(params.previousState),
        changedStateSummary: this.sanitize(params.changedState)
      });

      return await auditLog.save();
    } catch (err) {
      // Safe fallback - do not interrupt main business logic
      console.error('Audit logging failed safely:', err);
      return null;
    }
  }

  /**
   * Role-scoped listing of audit logs
   */
  async getAuditLogs(
    user: { id: string; role: string },
    query: {
      entityType?: string;
      action?: string;
      resultStatus?: string;
      page?: number;
      limit?: number;
    }
  ) {
    if (user.role === 'OWNER') {
      const err: any = new Error('Owners are not permitted to access system audit logs');
      err.statusCode = 403;
      throw err;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.entityType) filter.entityType = query.entityType;
    if (query.action) filter.action = query.action;
    if (query.resultStatus) filter.resultStatus = query.resultStatus;

    if (user.role === 'INSPECTOR') {
      filter['actor.userId'] = user.id;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export const auditService = new AuditService();
