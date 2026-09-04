import { Request, Response, NextFunction } from 'express';
import { riskService } from '../services/risk.service';

export class RiskController {
  /**
   * POST /api/risk/configurations
   * ADMIN creates a new risk configuration.
   */
  async createConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, weights, thresholds, missingDataStrategy } = req.body;
      const config = await riskService.createConfiguration(
        { name, weights, thresholds, missingDataStrategy },
        req.user!
      );
      res.status(201).json({
        status: 'success',
        message: 'Risk configuration created',
        data: { configuration: config }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/risk/configurations/:configId/activate
   * ADMIN activates a risk configuration (atomically deactivating any currently active).
   */
  async activateConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configId = String(req.params.configId);
      const config = await riskService.activateConfiguration(configId, req.user!);
      res.status(200).json({
        status: 'success',
        message: 'Risk configuration activated',
        data: { configuration: config }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/risk/configurations
   * ADMIN lists all risk configurations.
   */
  async listConfigurations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await riskService.listConfigurations(req.user!);
      res.status(200).json({
        status: 'success',
        data: { configurations: configs }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/risk/configurations/active
   * ADMIN and INSPECTOR retrieve the currently active risk configuration.
   */
  async getActiveConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await riskService.getActiveConfiguration(req.user!);
      res.status(200).json({
        status: 'success',
        data: { configuration: config }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/risk/instruments/:instrumentId/assess
   * ADMIN or INSPECTOR triggers a risk and trust assessment for an instrument.
   */
  async assessInstrument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instrumentId = String(req.params.instrumentId);
      const assessment = await riskService.assessInstrument(instrumentId, req.user!);
      res.status(201).json({
        status: 'success',
        message: 'Risk assessment completed successfully',
        data: { assessment }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/risk/instruments/:instrumentId/latest
   * OWNER (owned instrument only), INSPECTOR, and ADMIN retrieve the latest assessment.
   */
  async getLatestAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instrumentId = String(req.params.instrumentId);
      const assessment = await riskService.getLatestAssessment(instrumentId, req.user!);
      res.status(200).json({
        status: 'success',
        data: { assessment }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/risk/instruments/:instrumentId/history
   * OWNER (owned instrument only), INSPECTOR, and ADMIN retrieve assessment history.
   */
  async getAssessmentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const instrumentId = String(req.params.instrumentId);
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const result = await riskService.getAssessmentHistory(instrumentId, { page, limit }, req.user!);
      res.status(200).json({
        status: 'success',
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/risk/priorities
   * ADMIN and INSPECTOR retrieve instruments ranked by latest risk score.
   */
  async getPriorityList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const priorities = await riskService.getPriorityList(req.user!);
      res.status(200).json({
        status: 'success',
        data: { priorities }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const riskController = new RiskController();
