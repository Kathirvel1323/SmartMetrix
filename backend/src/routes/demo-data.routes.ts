import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { demoDataController } from '../controllers/demo-data.controller';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

router.post('/generate', (req, res, next) => demoDataController.generateDemoData(req, res, next));

export default router;
