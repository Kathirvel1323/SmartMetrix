import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Notification, INotification, NotificationType, NotificationSeverity } from '../models/notification.model';
import { User } from '../models/user.model';
import { Certificate } from '../models/certificate.model';
import { RiskAssessment } from '../models/risk-assessment.model';
import { RegionalCorrelationAssessment } from '../models/regional-correlation.model';
import { AnomalyAssessment } from '../models/anomaly-assessment.model';
import { ImprovementNotice } from '../models/improvement-notice.model';

export class NotificationService {
  private generateFingerprint(type: string, entityId: string, suffix: string = ''): string {
    const raw = `${type}:${entityId}:${suffix}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async createPerUserNotification(
    recipientId: mongoose.Types.ObjectId,
    recipientRole: string,
    data: {
      type: NotificationType;
      severity: NotificationSeverity;
      title: string;
      message: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      fingerprint: string;
    }
  ): Promise<{ created: boolean; notificationId: string }> {
    const notifId = `NOTIF-${uuidv4().substring(0, 8).toUpperCase()}`;
    try {
      const res = await Notification.updateOne(
        { recipient: recipientId, fingerprint: data.fingerprint },
        {
          $setOnInsert: {
            notificationId: notifId,
            recipient: recipientId,
            recipientRole,
            type: data.type,
            severity: data.severity,
            title: data.title,
            message: data.message,
            relatedEntityType: data.relatedEntityType,
            relatedEntityId: data.relatedEntityId,
            isRead: false,
            fingerprint: data.fingerprint
          }
        },
        { upsert: true }
      );
      return { created: res.upsertedCount > 0, notificationId: notifId };
    } catch {
      return { created: false, notificationId: notifId };
    }
  }

  async scanAndGenerateNotifications(): Promise<{ createdCount: number }> {
    let createdCount = 0;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const dateKey = now.toISOString().slice(0, 10);

    const adminUsers = await User.find({ role: 'ADMIN', isActive: true }).select('_id role').lean();

    // 1. Certificates expiring soon or expired
    const activeCerts = await Certificate.find({ status: 'VALID' }).lean();
    for (const cert of activeCerts) {
      const expDate = new Date(cert.expiresAt);
      const ownerId = cert.owner ? (cert.owner as any) : null;
      const certNum = cert.certificateNumber;
      const instId = cert.instrumentSnapshot?.instrumentId || '';

      if (expDate <= now) {
        const fp = this.generateFingerprint('CERTIFICATE_EXPIRED', certNum, dateKey);
        if (ownerId) {
          const res = await this.createPerUserNotification(ownerId, 'OWNER', {
            type: 'CERTIFICATE_EXPIRED',
            severity: 'HIGH',
            title: 'Certificate Expired',
            message: `Verification certificate ${certNum} for instrument ${instId} has expired.`,
            relatedEntityType: 'Certificate',
            relatedEntityId: certNum,
            fingerprint: fp
          });
          if (res.created) createdCount++;
        }
        for (const admin of adminUsers) {
          const res = await this.createPerUserNotification(admin._id, 'ADMIN', {
            type: 'CERTIFICATE_EXPIRED',
            severity: 'HIGH',
            title: 'Certificate Expired',
            message: `Verification certificate ${certNum} for instrument ${instId} has expired.`,
            relatedEntityType: 'Certificate',
            relatedEntityId: certNum,
            fingerprint: fp
          });
          if (res.created) createdCount++;
        }
      } else if (expDate <= in30Days) {
        const fp = this.generateFingerprint('CERTIFICATE_EXPIRING', certNum, dateKey);
        if (ownerId) {
          const res = await this.createPerUserNotification(ownerId, 'OWNER', {
            type: 'CERTIFICATE_EXPIRING',
            severity: 'WARNING',
            title: 'Certificate Nearing Expiry',
            message: `Verification certificate ${certNum} for instrument ${instId} will expire on ${expDate.toISOString().slice(0, 10)}.`,
            relatedEntityType: 'Certificate',
            relatedEntityId: certNum,
            fingerprint: fp
          });
          if (res.created) createdCount++;
        }
      }
    }

    // 2. High / Critical risk assessments
    const highRisks = await RiskAssessment.find({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } }).lean();
    for (const risk of highRisks) {
      const fp = this.generateFingerprint('HIGH_RISK_DETECTED', risk.assessmentId);
      for (const admin of adminUsers) {
        const res = await this.createPerUserNotification(admin._id, 'ADMIN', {
          type: 'HIGH_RISK_DETECTED',
          severity: risk.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `${risk.riskLevel} Risk Detected`,
          message: `Elevated risk level (${risk.riskLevel}) assessed for instrument ${risk.instrumentIdSnapshot}.`,
          relatedEntityType: 'RiskAssessment',
          relatedEntityId: risk.assessmentId,
          fingerprint: fp
        });
        if (res.created) createdCount++;
      }
    }

    // 3. Potential regional clusters
    const clusters = await RegionalCorrelationAssessment.find({ patternType: 'Potential Cluster' }).lean();
    for (const cl of clusters) {
      const fp = this.generateFingerprint('REGIONAL_CLUSTER_DETECTED', cl.assessmentId);
      for (const admin of adminUsers) {
        const res = await this.createPerUserNotification(admin._id, 'ADMIN', {
          type: 'REGIONAL_CLUSTER_DETECTED',
          severity: 'WARNING',
          title: 'Potential Regional Cluster Identified',
          message: `Regional correlation engine flagged a potential cluster for instrument ${cl.instrumentIdSnapshot}.`,
          relatedEntityType: 'RegionalCorrelationAssessment',
          relatedEntityId: cl.assessmentId,
          fingerprint: fp
        });
        if (res.created) createdCount++;
      }
    }

    // 4. Potential Anomaly assessments
    const anomalies = await AnomalyAssessment.find({ potentialAnomaly: true }).lean();
    for (const anom of anomalies) {
      const fp = this.generateFingerprint('ANOMALY_DETECTED', anom.assessmentId);
      for (const admin of adminUsers) {
        const res = await this.createPerUserNotification(admin._id, 'ADMIN', {
          type: 'ANOMALY_DETECTED',
          severity: 'WARNING',
          title: 'Potential Anomaly Flagged',
          message: `Anomaly detection flagged statistical deviation for instrument ${anom.instrumentIdSnapshot} (score: ${anom.anomalyScore}).`,
          relatedEntityType: 'AnomalyAssessment',
          relatedEntityId: anom.assessmentId,
          fingerprint: fp
        });
        if (res.created) createdCount++;
      }
    }

    // 5. Improvement Notice deadlines
    const notices = await ImprovementNotice.find({ status: { $in: ['OPEN', 'CORRECTION_IN_PROGRESS'] } }).lean();
    for (const notice of notices) {
      const dueDate = new Date(notice.deadline);
      const fp = this.generateFingerprint('NOTICE_DEADLINE_APPROACHING', notice.noticeId, dateKey);
      if (notice.issuedBy) {
        const res = await this.createPerUserNotification(notice.issuedBy, 'INSPECTOR', {
          type: 'NOTICE_DEADLINE_APPROACHING',
          severity: 'HIGH',
          title: 'Improvement Notice Deadline',
          message: `Improvement notice ${notice.noticeId} has compliance deadline ${dueDate.toISOString().slice(0, 10)}.`,
          relatedEntityType: 'ImprovementNotice',
          relatedEntityId: notice.noticeId,
          fingerprint: fp
        });
        if (res.created) createdCount++;
      }
    }

    return { createdCount };
  }

  async getNotifications(
    user: { id: string; role: string },
    query: { isRead?: boolean; page?: number; limit?: number }
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const userOid = new mongoose.Types.ObjectId(user.id);
    const filter: any = { recipient: userOid };

    if (query.isRead !== undefined) {
      filter.isRead = String(query.isRead) === 'true';
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userOid, isRead: false })
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async markAsRead(user: { id: string; role: string }, notificationId: string): Promise<INotification> {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const notification = await Notification.findOneAndUpdate(
      { notificationId, recipient: userOid },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      const err: any = new Error('Notification not found or access forbidden');
      err.statusCode = 404;
      throw err;
    }

    return notification;
  }

  async broadcast(params: {
    title: string;
    message: string;
    recipientRole?: string;
    severity?: NotificationSeverity;
  }): Promise<{ notificationId: string; title: string; message: string; recipientRole?: string; createdCount: number }> {
    const roleFilter: any = { isActive: true };
    if (params.recipientRole) roleFilter.role = params.recipientRole;
    const recipients = await User.find(roleFilter).select('_id role').lean();

    let createdCount = 0;
    const broadcastKey = uuidv4();
    const fp = this.generateFingerprint('OPERATIONAL_BROADCAST', broadcastKey);
    const mainNotifId = `NOTIF-${uuidv4().substring(0, 8).toUpperCase()}`;

    for (const rec of recipients) {
      const res = await this.createPerUserNotification(rec._id, rec.role, {
        type: 'OPERATIONAL_BROADCAST',
        severity: params.severity || 'INFO',
        title: params.title,
        message: params.message,
        fingerprint: fp
      });
      if (res.created) createdCount++;
    }

    return {
      notificationId: mainNotifId,
      title: params.title,
      message: params.message,
      recipientRole: params.recipientRole,
      createdCount
    };
  }
}

export const notificationService = new NotificationService();
