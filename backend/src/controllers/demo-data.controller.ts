import { Request, Response, NextFunction } from 'express';
import { demoDataService } from '../services/demo-data.service';

export class DemoDataController {
  async generateDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
      }

      const { count, seed, idempotencyKey } = req.body || {};
      const batch = await demoDataService.generateDemoData(user, {
        count: count ? Number(count) : undefined,
        seed: seed ? String(seed) : undefined,
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined
      });

      return res.status(201).json({
        status: 'success',
        data: {
          batchId: batch.batchId,
          status: batch.status,
          count: batch.count,
          recordCounts: batch.recordCounts,
          errorSummary: batch.errorSummary,
          idempotencyKey: batch.idempotencyKey
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

export const demoDataController = new DemoDataController();
