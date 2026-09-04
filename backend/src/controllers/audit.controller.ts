import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';

export class AuditController {
  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await auditService.getAuditLogs(user, {
        entityType: req.query.entityType as string,
        action: req.query.action as string,
        resultStatus: req.query.resultStatus as string,
        page: Number(req.query.page),
        limit: Number(req.query.limit)
      });

      return res.status(200).json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }
}

export const auditController = new AuditController();
