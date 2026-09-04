import { Router } from 'express';
import { regionalController } from '../controllers/regional.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// 1. Map endpoint (GeoJSON FeatureCollection) - ADMIN, INSPECTOR, OWNER
router.get('/map', regionalController.getMapData.bind(regionalController));

// 2. Regional configs
router.post(
  '/configs',
  authorizeRoles('ADMIN'),
  regionalController.createConfig.bind(regionalController)
);

router.post(
  '/configs/:configId/activate',
  authorizeRoles('ADMIN'),
  regionalController.activateConfig.bind(regionalController)
);

router.get(
  '/configs/active',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  regionalController.getActiveConfig.bind(regionalController)
);

// 3. Cluster identification - ADMIN, INSPECTOR
router.get(
  '/clusters',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  regionalController.getClusters.bind(regionalController)
);

// 4. Instrument regional analysis - ADMIN, INSPECTOR
router.post(
  '/instruments/:instrumentId/analyze',
  authorizeRoles('ADMIN', 'INSPECTOR'),
  regionalController.analyzeInstrument.bind(regionalController)
);

// 5. Latest correlation per instrument - ADMIN, INSPECTOR, OWNER (ownership scoped in service)
router.get(
  '/instruments/:instrumentId/latest',
  authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'),
  regionalController.getLatestCorrelation.bind(regionalController)
);

export default router;
