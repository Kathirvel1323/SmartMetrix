import { Request, Response, NextFunction } from 'express';
import { publicVerificationService } from '../services/public-verification.service';

export class PublicVerificationController {
  async verifyPublicCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const publicId = Array.isArray(req.params.publicVerificationId) ? req.params.publicVerificationId[0] : req.params.publicVerificationId;
      const data = await publicVerificationService.verifyPublicCertificate(publicId);

      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        status: 'success',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async getQrCodePng(req: Request, res: Response, next: NextFunction) {
    try {
      const publicId = Array.isArray(req.params.publicVerificationId) ? req.params.publicVerificationId[0] : req.params.publicVerificationId;
      const pngBuffer = await publicVerificationService.generateQrCodeBuffer(publicId);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(pngBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export const publicVerificationController = new PublicVerificationController();
