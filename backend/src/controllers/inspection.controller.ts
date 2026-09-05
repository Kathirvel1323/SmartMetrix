import { Request, Response, NextFunction } from 'express';
import { inspectionService } from '../services/inspection.service';
import { resolveEvidencePath, cleanupUploadedFiles } from '../middleware/upload.middleware';
import { Inspection } from '../models/inspection.model';

export class InspectionController {
  /**
   * POST /api/inspections
   * INSPECTOR submits a field inspection (multipart/form-data with optional evidence files).
   */
  async submitInspection(req: Request, res: Response, next: NextFunction): Promise<void> {
    const files = (req.files as Express.Multer.File[]) || [];

    try {
      // Strip protected/system-controlled fields from body
      const {
        verificationRequestId,
        inspectionDate,
        referenceReading,
        actualReading,
        inspectorResult,
        overrideReason,
        serialNumberMatch,
        sealCondition,
        displayCondition,
        physicalDamage,
        nameplateCondition,
        potentialTamperingIndicators,
        installationCondition,
        remarks,
        gpsLongitude,
        gpsLatitude,
        gpsAccuracy,
        gpsCapturedAt
      } = req.body;

      const inspection = await inspectionService.submitInspection(
        {
          verificationRequestId,
          inspectionDate,
          referenceReading,
          actualReading,
          inspectorResult,
          overrideReason,
          serialNumberMatch,
          sealCondition,
          displayCondition,
          physicalDamage,
          nameplateCondition,
          potentialTamperingIndicators,
          installationCondition,
          remarks,
          gpsLongitude,
          gpsLatitude,
          gpsAccuracy,
          gpsCapturedAt
        },
        files,
        req.user!
      );

      res.status(201).json({
        status: 'success',
        message: 'Inspection submitted successfully',
        data: { inspection }
      });
    } catch (error) {
      // Cleanup is handled in service, but guard here too in case of unexpected errors
      cleanupUploadedFiles(files);
      next(error);
    }
  }

  /**
   * GET /api/inspections
   * Role-scoped listing.
   */
  async listInspections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, inspectorId, instrumentId, verificationRequestId, inspectorResult } = req.query;
      const result = await inspectionService.listInspections(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          inspectorId: inspectorId as string,
          instrumentId: instrumentId as string,
          verificationRequestId: verificationRequestId as string,
          inspectorResult: inspectorResult as 'PASS' | 'FAIL'
        },
        req.user!
      );
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:inspectionId
   * Role-scoped single inspection retrieval.
   */
  async getInspectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspectionId = String(req.params.inspectionId);
      const inspection = await inspectionService.getInspectionById(inspectionId, req.user!);
      res.status(200).json({ status: 'success', data: { inspection } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/inspections/:inspectionId/evidence/:evidenceId
   * Protected evidence file retrieval — ADMIN and assigned INSPECTOR only.
   * Never exposes the upload directory publicly.
   */
  async getEvidenceFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { inspectionId, evidenceId } = req.params;
      const caller = req.user!;

      // Only ADMIN or INSPECTOR can access evidence
      if (caller.role !== 'ADMIN' && caller.role !== 'INSPECTOR') {
        res.status(403).json({ status: 'error', message: 'Access forbidden: ADMIN or INSPECTOR only' });
        return;
      }

      const formattedId = String(inspectionId).trim().toUpperCase();
      const inspection = await Inspection.findOne({ inspectionId: formattedId }).select('+evidence.storedFilename');
      if (!inspection) {
        res.status(404).json({ status: 'error', message: 'Inspection not found' });
        return;
      }

      // INSPECTOR must be the assigned inspector
      if (caller.role === 'INSPECTOR' && inspection.inspector.toString() !== caller._id.toString()) {
        res.status(404).json({ status: 'error', message: 'Inspection not found' });
        return;
      }

      const evidenceRecord = inspection.evidence.find((e) => e.evidenceId === evidenceId);
      if (!evidenceRecord || !evidenceRecord.storedFilename) {
        res.status(404).json({ status: 'error', message: 'Evidence file not found' });
        return;
      }

      const filePath = resolveEvidencePath(evidenceRecord.storedFilename);
      if (!filePath) {
        res.status(404).json({ status: 'error', message: 'Evidence file not found on server' });
        return;
      }

      res.setHeader('Content-Type', evidenceRecord.originalMime);
      res.setHeader('Content-Disposition', `inline; filename="${evidenceRecord.evidenceId}"`);
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }
}

export const inspectionController = new InspectionController();
