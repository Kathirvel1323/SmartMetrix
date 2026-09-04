import { Router } from 'express';
import { improvementNoticeController } from '../controllers/improvement-notice.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', authorizeRoles('ADMIN', 'INSPECTOR'), improvementNoticeController.issueNotice.bind(improvementNoticeController));
router.get('/', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), improvementNoticeController.listNotices.bind(improvementNoticeController));
router.get('/:noticeId', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), improvementNoticeController.getNoticeById.bind(improvementNoticeController));
router.patch('/:noticeId/status', authorizeRoles('ADMIN', 'INSPECTOR', 'OWNER'), improvementNoticeController.updateNoticeStatus.bind(improvementNoticeController));

export default router;
