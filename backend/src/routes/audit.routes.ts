import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { auditController } from '../controllers/audit.controller';

const router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => auditController.getAuditLogs(req, res, next));

export default router;
