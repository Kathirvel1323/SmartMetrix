import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { auditService } from '../services/audit.service';

export class NotificationController {
  async scanNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
      }

      const result = await notificationService.scanAndGenerateNotifications();

      await auditService.logAction({
        actor: { userId: user.id, role: user.role, email: user.email },
        action: 'TRIGGER_NOTIFICATION_SCAN',
        entityType: 'Notification',
        entityId: 'SYSTEM_SCAN',
        metadata: { createdCount: result.createdCount }
      });

      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const isReadParam = req.query.isRead !== undefined ? String(req.query.isRead) === 'true' : undefined;

      const result = await notificationService.getNotifications(user, {
        isRead: isReadParam,
        page: Number(req.query.page),
        limit: Number(req.query.limit)
      });

      return res.status(200).json({
        status: 'success',
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const updated = await notificationService.markAsRead(user, notificationId);

      return res.status(200).json({
        status: 'success',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async broadcastNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ status: 'error', message: 'Forbidden: Admin access required' });
      }

      const { title, message, recipientRole, severity } = req.body;
      if (!title || !message) {
        return res.status(400).json({ status: 'error', message: 'Title and message are required' });
      }

      const result = await notificationService.broadcast({ title, message, recipientRole, severity });

      await auditService.logAction({
        actor: { userId: user.id, role: user.role, email: user.email },
        action: 'BROADCAST_NOTIFICATION',
        entityType: 'Notification',
        entityId: 'BROADCAST',
        metadata: { title, recipientRole, severity, createdCount: result.createdCount }
      });

      return res.status(201).json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
