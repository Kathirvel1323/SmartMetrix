import { Router } from 'express';
import { anomalyController } from '../controllers/anomaly.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// 1. GET /api/anomaly/potential-anomalies — ADMIN and INSPECTOR only
router.get(
  '/potential-anomalies',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  anomalyController.getPotentialAnomalies.bind(anomalyController)
);

// 2. POST /api/anomaly/batch — ADMIN and INSPECTOR only
router.post(
  '/batch',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  anomalyController.analyzeBatch.bind(anomalyController)
);

// 3. POST /api/anomaly/instruments/:instrumentId/analyze — ADMIN and INSPECTOR only
router.post(
  '/instruments/:instrumentId/analyze',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  anomalyController.analyzeInstrument.bind(anomalyController)
);

// 4. GET /api/anomaly/instruments/:instrumentId/latest — OWNER (own only), INSPECTOR, ADMIN
router.get(
  '/instruments/:instrumentId/latest',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  anomalyController.getLatestAssessment.bind(anomalyController)
);

export default router;
