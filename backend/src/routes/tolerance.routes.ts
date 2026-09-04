import { Router } from 'express';
import { toleranceController } from '../controllers/tolerance.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/tolerance-rules — All authenticated roles can list
router.get(
  '/',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  toleranceController.listRules.bind(toleranceController)
);

// GET /api/tolerance-rules/:ruleId — All authenticated roles can view a single rule
router.get(
  '/:ruleId',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  toleranceController.getRuleById.bind(toleranceController)
);

// POST /api/tolerance-rules — ADMIN only
router.post(
  '/',
  authorizeRoles('ADMIN'),
  toleranceController.createRule.bind(toleranceController)
);

// PATCH /api/tolerance-rules/:ruleId — ADMIN only (creates new version)
router.patch(
  '/:ruleId',
  authorizeRoles('ADMIN'),
  toleranceController.updateRule.bind(toleranceController)
);

// PATCH /api/tolerance-rules/:ruleId/deactivate — ADMIN only
router.patch(
  '/:ruleId/deactivate',
  authorizeRoles('ADMIN'),
  toleranceController.deactivateRule.bind(toleranceController)
);

export default router;
