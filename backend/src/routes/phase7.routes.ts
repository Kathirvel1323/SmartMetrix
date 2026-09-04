import { Router } from 'express';
import multer from 'multer';
import { phase7Controller } from '../controllers/phase7.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = Router();

router.use(authenticate);

// 1. Photo Assist
router.post(
  '/photo-assist/analyze',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  upload.single('file'),
  phase7Controller.analyzePhoto.bind(phase7Controller)
);

router.get(
  '/photo-assist/instruments/:instrumentId/latest',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  phase7Controller.getLatestPhotoAssist.bind(phase7Controller)
);

// 2. Predictive Analytics
router.post(
  '/predictive/instruments/:instrumentId/analyze',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  phase7Controller.analyzePredictive.bind(phase7Controller)
);

router.get(
  '/predictive/instruments/:instrumentId/latest',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  phase7Controller.getLatestPredictive.bind(phase7Controller)
);

// 3. Verification Planning Twin & Burden Optimization
router.get(
  '/planning/twin/:instrumentId',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  phase7Controller.getPlanningTwin.bind(phase7Controller)
);

router.post(
  '/planning/burden-optimize',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  phase7Controller.optimizeBurden.bind(phase7Controller)
);

// 4. Geo-Scheduling Recommendation
router.post(
  '/planning/geo-schedule-recommend',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  phase7Controller.recommendGeoSchedule.bind(phase7Controller)
);

// 5. ADMIN Verification Rules Management
router.post(
  '/admin/verification-rules',
  authorizeRoles('ADMIN'),
  phase7Controller.createVerificationRule.bind(phase7Controller)
);

router.get(
  '/admin/verification-rules',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  phase7Controller.listVerificationRules.bind(phase7Controller)
);

router.post(
  '/admin/verification-rules/:ruleId/deactivate',
  authorizeRoles('ADMIN'),
  phase7Controller.deactivateVerificationRule.bind(phase7Controller)
);

export default router;
