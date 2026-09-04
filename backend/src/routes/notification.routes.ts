import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.post('/scan', authorizeRoles('ADMIN'), (req, res, next) => notificationController.scanNotifications(req, res, next));
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));
router.post('/broadcast', authorizeRoles('ADMIN'), (req, res, next) => notificationController.broadcastNotification(req, res, next));

export default router;
