import { Router } from 'express';
import { riskController } from '../controllers/risk.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// 1. GET /api/risk/configurations/active — ADMIN and INSPECTOR
router.get(
  '/configurations/active',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  riskController.getActiveConfiguration.bind(riskController)
);

// 2. GET /api/risk/configurations — ADMIN only
router.get(
  '/configurations',
  authorizeRoles('ADMIN'),
  riskController.listConfigurations.bind(riskController)
);

// 3. POST /api/risk/configurations — ADMIN only
router.post(
  '/configurations',
  authorizeRoles('ADMIN'),
  riskController.createConfiguration.bind(riskController)
);

// 4. PATCH /api/risk/configurations/:configId/activate — ADMIN only
router.patch(
  '/configurations/:configId/activate',
  authorizeRoles('ADMIN'),
  riskController.activateConfiguration.bind(riskController)
);

// 5. GET /api/risk/priorities — ADMIN and INSPECTOR
router.get(
  '/priorities',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  riskController.getPriorityList.bind(riskController)
);

// 6. POST /api/risk/instruments/:instrumentId/assess — ADMIN and INSPECTOR
router.post(
  '/instruments/:instrumentId/assess',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  riskController.assessInstrument.bind(riskController)
);

// 7. GET /api/risk/instruments/:instrumentId/latest — OWNER (scoped to own), INSPECTOR, ADMIN
router.get(
  '/instruments/:instrumentId/latest',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  riskController.getLatestAssessment.bind(riskController)
);

// 8. GET /api/risk/instruments/:instrumentId/history — OWNER (scoped to own), INSPECTOR, ADMIN
router.get(
  '/instruments/:instrumentId/history',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  riskController.getAssessmentHistory.bind(riskController)
);

export default router;
