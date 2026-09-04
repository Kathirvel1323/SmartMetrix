import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// All verification routes require authentication
router.use(authenticate);

// 1. Submit Verification Request (OWNER only)
router.post(
  '/',
  authorizeRoles('OWNER'),
  verificationController.createVerificationRequest.bind(verificationController)
);

// 2. List Verification Requests (OWNER, INSPECTOR, ADMIN - scoped by role)
router.get(
  '/',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  verificationController.listVerificationRequests.bind(verificationController)
);

// 3. Get Single Verification Request by requestId (OWNER, INSPECTOR, ADMIN - scoped)
router.get(
  '/:requestId',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  verificationController.getVerificationRequestById.bind(verificationController)
);

// 4. Admin Review: SUBMITTED → UNDER_REVIEW
router.patch(
  '/:requestId/review',
  authorizeRoles('ADMIN'),
  verificationController.reviewVerificationRequest.bind(verificationController)
);

// 5. Admin Assignment: UNDER_REVIEW → ASSIGNED
router.patch(
  '/:requestId/assign',
  authorizeRoles('ADMIN'),
  verificationController.assignInspector.bind(verificationController)
);

// 6. Admin Scheduling / Rescheduling: ASSIGNED → SCHEDULED
router.patch(
  '/:requestId/schedule',
  authorizeRoles('ADMIN'),
  verificationController.scheduleVerification.bind(verificationController)
);

export default router;
