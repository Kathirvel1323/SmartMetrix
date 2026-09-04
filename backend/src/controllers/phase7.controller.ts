import { Request, Response, NextFunction } from 'express';
import { photoAssistService } from '../services/photo-assist.service';
import { predictiveService } from '../services/predictive.service';
import { planningService } from '../services/planning.service';

export class Phase7Controller {
  // Photo Assist
  async analyzePhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = (req.body.instrumentId || req.query.instrumentId || '').toString();
      const inspectionId = req.body.inspectionId ? req.body.inspectionId.toString() : undefined;
      const file = (req as any).file;

      if (!instrumentId) {
        return res.status(400).json({ status: 'error', message: 'instrumentId is required' });
      }
      if (!file || !file.buffer) {
        return res.status(400).json({ status: 'error', message: 'Image file payload is required' });
      }

      const assessment = await photoAssistService.analyzePhotoQuality(
        instrumentId,
        file.buffer,
        file.originalname || 'photo.jpg',
        req.user!,
        inspectionId
      );

      return res.status(201).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  async getLatestPhotoAssist(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const assessment = await photoAssistService.getLatestPhotoAssist(instrumentId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  // Predictive Analytics
  async analyzePredictive(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const assessment = await predictiveService.analyzePredictiveTrend(instrumentId, req.user!);
      return res.status(201).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  async getLatestPredictive(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const assessment = await predictiveService.getLatestPredictive(instrumentId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  // Planning Twin & Optimization
  async getPlanningTwin(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const twin = await planningService.getPlanningTwin(instrumentId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { twin }
      });
    } catch (err) {
      next(err);
    }
  }

  async optimizeBurden(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = (req.body.instrumentId || '').toString();
      if (!instrumentId) {
        return res.status(400).json({ status: 'error', message: 'instrumentId is required' });
      }
      const result = await planningService.optimizeBurden(instrumentId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async recommendGeoSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await planningService.recommendGeoSchedule(req.body, req.user!);
      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // Verification Rule Admin Management
  async createVerificationRule(req: Request, res: Response, next: NextFunction) {
    try {
      const rule = await planningService.createVerificationRule(req.body, req.user!);
      return res.status(201).json({
        status: 'success',
        data: { rule }
      });
    } catch (err) {
      next(err);
    }
  }

  async listVerificationRules(req: Request, res: Response, next: NextFunction) {
    try {
      const rules = await planningService.listVerificationRules(req.user!);
      return res.status(200).json({
        status: 'success',
        data: { rules }
      });
    } catch (err) {
      next(err);
    }
  }

  async deactivateVerificationRule(req: Request, res: Response, next: NextFunction) {
    try {
      const ruleId = Array.isArray(req.params.ruleId) ? req.params.ruleId[0] : req.params.ruleId;
      const rule = await planningService.softDeactivateRule(ruleId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { rule }
      });
    } catch (err) {
      next(err);
    }
  }
}

export const phase7Controller = new Phase7Controller();
