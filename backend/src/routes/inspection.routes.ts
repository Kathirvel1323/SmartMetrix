import { Router } from 'express';
import { inspectionController } from '../controllers/inspection.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { evidenceUploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// POST /api/inspections — INSPECTOR only, multipart/form-data with up to 5 evidence files
router.post(
  '/',
  authorizeRoles('INSPECTOR'),
  evidenceUploadMiddleware,
  inspectionController.submitInspection.bind(inspectionController)
);

// GET /api/inspections — Role-scoped listing
router.get(
  '/',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  inspectionController.listInspections.bind(inspectionController)
);

// GET /api/inspections/:inspectionId — Role-scoped single retrieval
router.get(
  '/:inspectionId',
  authorizeRoles('OWNER', 'INSPECTOR', 'ADMIN'),
  inspectionController.getInspectionById.bind(inspectionController)
);

// GET /api/inspections/:inspectionId/evidence/:evidenceId — ADMIN and INSPECTOR only
router.get(
  '/:inspectionId/evidence/:evidenceId',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  inspectionController.getEvidenceFile.bind(inspectionController)
);

export default router;
