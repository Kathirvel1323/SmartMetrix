import { Request, Response, NextFunction } from 'express';
import { anomalyService } from '../services/anomaly.service';

export class AnomalyController {
  /**
   * POST /api/anomaly/instruments/:instrumentId/analyze
   * ADMIN or INSPECTOR triggers anomaly analysis for a specific instrument.
   */
  async analyzeInstrument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instrumentId = String(req.params.instrumentId);
      const assessment = await anomalyService.analyzeInstrument(instrumentId, req.user!);
      res.status(201).json({
        status: 'success',
        message: 'Anomaly analysis completed',
        data: { assessment }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/anomaly/batch
   * ADMIN or INSPECTOR triggers batch anomaly analysis across all instruments
   * that have at least one finalized inspection.
   */
  async analyzeBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await anomalyService.analyzeBatch(req.user!);
      res.status(201).json({
        status: 'success',
        message: 'Batch anomaly analysis completed',
        data: {
          totalAnalyzed: result.totalAnalyzed,
          assessments: result.assessments
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/anomaly/instruments/:instrumentId/latest
   * OWNER (own instruments only), INSPECTOR, or ADMIN retrieves latest assessment.
   */
  async getLatestAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instrumentId = String(req.params.instrumentId);
      const assessment = await anomalyService.getLatestAssessment(instrumentId, req.user!);
      res.status(200).json({
        status: 'success',
        data: { assessment }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/anomaly/potential-anomalies
   * ADMIN and INSPECTOR only: list all instruments with potentialAnomaly === true
   * in their latest assessment, sorted by anomalyScore descending.
   */
  async getPotentialAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await anomalyService.getPotentialAnomalies(req.user!);
      res.status(200).json({
        status: 'success',
        data: { potentialAnomalies: results }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const anomalyController = new AnomalyController();
