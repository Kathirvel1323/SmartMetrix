import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { reportController } from '../controllers/report.controller';

const router = Router();

router.use(authenticate);

router.get('/:reportType', (req, res, next) => reportController.generateReport(req, res, next));

export default router;
