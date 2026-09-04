import { Request, Response, NextFunction } from 'express';
import { regionalService } from '../services/regional.service';

export class RegionalController {
  /**
   * POST /api/regional/configs
   * ADMIN only: Create regional config
   */
  async createConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await regionalService.createConfiguration(req.body, req.user!);
      return res.status(201).json({
        status: 'success',
        data: { config }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/regional/configs/:configId/activate
   * ADMIN only: Activate config
   */
  async activateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const configId = Array.isArray(req.params.configId) ? req.params.configId[0] : req.params.configId;
      const config = await regionalService.activateConfiguration(configId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { config }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/regional/configs/active
   * ADMIN/INSPECTOR: Get active config
   */
  async getActiveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await regionalService.getActiveConfiguration(req.user!);
      return res.status(200).json({
        status: 'success',
        data: { config }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/regional/instruments/:instrumentId/analyze
   * ADMIN/INSPECTOR: Analyze regional correlation for instrument
   */
  async analyzeInstrument(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const radiusKm = req.body.radiusKm ? Number(req.body.radiusKm) : undefined;
      const assessment = await regionalService.analyzeRegionalCorrelation(
        instrumentId,
        radiusKm,
        req.user!
      );
      return res.status(201).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/regional/instruments/:instrumentId/latest
   * ADMIN, INSPECTOR, OWNER (owned only): Get latest regional correlation
   */
  async getLatestCorrelation(req: Request, res: Response, next: NextFunction) {
    try {
      const instrumentId = Array.isArray(req.params.instrumentId) ? req.params.instrumentId[0] : req.params.instrumentId;
      const assessment = await regionalService.getLatestCorrelation(instrumentId, req.user!);
      return res.status(200).json({
        status: 'success',
        data: { assessment }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/regional/clusters
   * ADMIN/INSPECTOR: List regional clusters
   */
  async getClusters(req: Request, res: Response, next: NextFunction) {
    try {
      const clusters = await regionalService.getRegionalClusters(req.user!);
      return res.status(200).json({
        status: 'success',
        data: { clusters }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/regional/map
   * ADMIN, INSPECTOR, OWNER: Regional map GeoJSON FeatureCollection
   */
  async getMapData(req: Request, res: Response, next: NextFunction) {
    try {
      const geojson = await regionalService.getRegionalMapData(req.user!);
      return res.status(200).json(geojson);
    } catch (err) {
      next(err);
    }
  }
}

export const regionalController = new RegionalController();
