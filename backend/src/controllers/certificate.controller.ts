import { Request, Response, NextFunction } from 'express';
import { certificateService } from '../services/certificate.service';

export class CertificateController {
  // Policies
  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const policy = await certificateService.createPolicy(req.body, req.user!);
      return res.status(201).json({ status: 'success', data: { policy } });
    } catch (err) {
      next(err);
    }
  }

  async activatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const policyId = Array.isArray(req.params.policyId) ? req.params.policyId[0] : req.params.policyId;
      const policy = await certificateService.activatePolicy(policyId, req.user!);
      return res.status(200).json({ status: 'success', data: { policy } });
    } catch (err) {
      next(err);
    }
  }

  async deactivatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const policyId = Array.isArray(req.params.policyId) ? req.params.policyId[0] : req.params.policyId;
      const policy = await certificateService.softDeactivatePolicy(policyId, req.user!);
      return res.status(200).json({ status: 'success', data: { policy } });
    } catch (err) {
      next(err);
    }
  }

  async listPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const policies = await certificateService.listPolicies(req.user!);
      return res.status(200).json({ status: 'success', data: { policies } });
    } catch (err) {
      next(err);
    }
  }

  // Certificates
  async issueCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const certificate = await certificateService.issueCertificate(req.body, req.user!);
      return res.status(201).json({ status: 'success', data: { certificate } });
    } catch (err) {
      next(err);
    }
  }

  async revokeCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const certNum = Array.isArray(req.params.certificateNumber) ? req.params.certificateNumber[0] : req.params.certificateNumber;
      const reason = req.body.reason;
      const certificate = await certificateService.revokeCertificate(certNum, reason, req.user!);
      return res.status(200).json({ status: 'success', data: { certificate } });
    } catch (err) {
      next(err);
    }
  }

  async getCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const certNum = Array.isArray(req.params.certificateNumber) ? req.params.certificateNumber[0] : req.params.certificateNumber;
      const certificate = await certificateService.getCertificateByNumber(certNum, req.user!);
      return res.status(200).json({ status: 'success', data: { certificate } });
    } catch (err) {
      next(err);
    }
  }

  async listCertificates(req: Request, res: Response, next: NextFunction) {
    try {
      const certificates = await certificateService.listCertificates(req.user!);
      return res.status(200).json({ status: 'success', data: { certificates } });
    } catch (err) {
      next(err);
    }
  }
}

export const certificateController = new CertificateController();
