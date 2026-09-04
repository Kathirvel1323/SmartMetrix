import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';

export class AnalyticsController {
  async getDashboardKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getDashboardKpis(user, req.query as any);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getVerificationDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getVerificationDistribution(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getRiskDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getRiskDistribution(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getPassFailTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getPassFailTrends(user, req.query as any);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getCertificateValidity(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getCertificateValidity(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getCityDistribution(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getCityDistribution(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getImprovementNoticeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getImprovementNoticeStatus(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getComplaintStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getComplaintStatus(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getAnomalyAndClusterCounts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getAnomalyAndClusterCounts(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  async getPriorityInspections(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await analyticsService.getPriorityInspections(user);
      return res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
