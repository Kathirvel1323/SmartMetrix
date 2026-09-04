import { Request, Response, NextFunction } from 'express';
import { verificationService } from '../services/verification.service';

export class VerificationController {
  /**
   * POST /api/verifications
   * OWNER creates a new verification request
   */
  async createVerificationRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Strip client-supplied system/protected fields
      const { instrumentId, verificationType, remarks } = req.body;

      const verification = await verificationService.createVerificationRequest(
        {
          instrumentId,
          verificationType,
          remarks
        },
        req.user!
      );

      res.status(201).json({
        status: 'success',
        message: 'Verification request submitted successfully',
        data: { verification }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/verifications
   * Role-scoped listing of verification requests
   */
  async listVerificationRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, verificationType, startDate, endDate, inspectorId, ownerId } =
        req.query;

      const result = await verificationService.listVerificationRequests(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          status: status as string,
          verificationType: verificationType as string,
          startDate: startDate as string,
          endDate: endDate as string,
          inspectorId: inspectorId as string,
          ownerId: ownerId as string
        },
        req.user!
      );

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
   * GET /api/verifications/:requestId
   * Role-scoped retrieval of a single verification request
   */
  async getVerificationRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = String(req.params.requestId);
      const verification = await verificationService.getVerificationRequestById(requestId, req.user!);

      res.status(200).json({
        status: 'success',
        data: { verification }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/verifications/:requestId/review
   * ADMIN reviews request: SUBMITTED → UNDER_REVIEW
   */
  async reviewVerificationRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = String(req.params.requestId);
      const { reviewRemarks } = req.body;

      const verification = await verificationService.reviewVerificationRequest(
        requestId,
        { reviewRemarks },
        req.user!
      );

      res.status(200).json({
        status: 'success',
        message: 'Verification request moved to UNDER_REVIEW',
        data: { verification }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/verifications/:requestId/assign
   * ADMIN assigns an active inspector: UNDER_REVIEW → ASSIGNED
   */
  async assignInspector(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = String(req.params.requestId);
      const { inspectorId, remarks } = req.body;

      const verification = await verificationService.assignInspector(
        requestId,
        { inspectorId, remarks },
        req.user!
      );

      res.status(200).json({
        status: 'success',
        message: 'Inspector assigned successfully',
        data: { verification }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/verifications/:requestId/schedule
   * ADMIN schedules or reschedules appointment: ASSIGNED → SCHEDULED
   */
  async scheduleVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = String(req.params.requestId);
      const { scheduledAt, estimatedDurationMinutes, scheduleLocation, scheduleNotes } = req.body;

      const verification = await verificationService.scheduleVerification(
        requestId,
        {
          scheduledAt,
          estimatedDurationMinutes,
          scheduleLocation,
          scheduleNotes
        },
        req.user!
      );

      res.status(200).json({
        status: 'success',
        message: 'Verification scheduled successfully',
        data: { verification }
      });
    } catch (error) {
      next(error);
    }
  }
}

export const verificationController = new VerificationController();
