import { Router } from 'express';
import { publicVerificationController } from '../controllers/public-verification.controller';
import { complaintService } from '../services/complaint.service';
import { publicRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

// Public Certificate Verification
router.get('/verify/:publicVerificationId', publicVerificationController.verifyPublicCertificate.bind(publicVerificationController));
router.get('/verify/:publicVerificationId/qr', publicVerificationController.getQrCodePng.bind(publicVerificationController));

// Public Consumer Complaints (Rate limited)
router.post('/complaints', publicRateLimiter, async (req, res, next) => {
  try {
    const result = await complaintService.submitPublicComplaint(req.body);
    return res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints/track/:trackingToken', async (req, res, next) => {
  try {
    const trackingToken = Array.isArray(req.params.trackingToken) ? req.params.trackingToken[0] : req.params.trackingToken;
    const result = await complaintService.trackPublicComplaint(trackingToken);
    return res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
