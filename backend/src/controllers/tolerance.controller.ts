import { Request, Response, NextFunction } from 'express';
import { toleranceService } from '../services/tolerance.service';

export class ToleranceController {
  /**
   * POST /api/tolerance-rules
   * ADMIN creates a new tolerance rule.
   */
  async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Strip protected fields
      const {
        name, instrumentType, instrumentCategory, capacityMin, capacityMax, capacityUnit,
        toleranceMode, toleranceValue, effectiveFrom, effectiveTo
      } = req.body;

      const rule = await toleranceService.createRule(
        {
          name, instrumentType, instrumentCategory,
          capacityMin: Number(capacityMin), capacityMax: Number(capacityMax), capacityUnit,
          toleranceMode, toleranceValue: Number(toleranceValue), effectiveFrom, effectiveTo
        },
        req.user!
      );

      res.status(201).json({ status: 'success', message: 'Tolerance rule created', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/tolerance-rules/:ruleId
   * ADMIN updates (new version of) a tolerance rule.
   */
  async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ruleId = String(req.params.ruleId);
      const { name, toleranceMode, toleranceValue, effectiveFrom, effectiveTo } = req.body;

      const rule = await toleranceService.updateRule(
        ruleId,
        { name, toleranceMode, toleranceValue: toleranceValue !== undefined ? Number(toleranceValue) : undefined, effectiveFrom, effectiveTo },
        req.user!
      );

      res.status(200).json({ status: 'success', message: 'Tolerance rule updated (new version created)', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/tolerance-rules/:ruleId/deactivate
   * ADMIN deactivates a rule without physical deletion.
   */
  async deactivateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ruleId = String(req.params.ruleId);
      const rule = await toleranceService.deactivateRule(ruleId, req.user!);
      res.status(200).json({ status: 'success', message: 'Tolerance rule deactivated', data: { rule } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tolerance-rules
   * All authenticated roles can list rules.
   */
  async listRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { instrumentType, instrumentCategory, activeOnly, page, limit } = req.query;
      const result = await toleranceService.listRules(
        {
          instrumentType: instrumentType as string,
          instrumentCategory: instrumentCategory as string,
          activeOnly: activeOnly !== 'false',
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined
        },
        req.user!
      );
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tolerance-rules/:ruleId
   * All authenticated roles can view a single rule.
   */
  async getRuleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ruleId = String(req.params.ruleId);
      const rule = await toleranceService.getRuleById(ruleId, req.user!);
      res.status(200).json({ status: 'success', data: { rule } });
    } catch (error) {
      next(error);
    }
  }
}

export const toleranceController = new ToleranceController();
