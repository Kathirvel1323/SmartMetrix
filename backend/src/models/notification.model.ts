import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'CERTIFICATE_EXPIRING'
  | 'CERTIFICATE_EXPIRED'
  | 'INSPECTION_SCHEDULED'
  | 'INSPECTION_OVERDUE'
  | 'HIGH_RISK_DETECTED'
  | 'REGIONAL_CLUSTER_DETECTED'
  | 'ANOMALY_DETECTED'
  | 'NOTICE_DEADLINE_APPROACHING'
  | 'OPERATIONAL_BROADCAST';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface INotification extends Document {
  notificationId: string;
  recipient: mongoose.Types.ObjectId;
  recipientRole?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  isRead: boolean;
  readAt?: Date;
  fingerprint: string;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    notificationId: { type: String, required: true, unique: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientRole: { type: String, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'CERTIFICATE_EXPIRING',
        'CERTIFICATE_EXPIRED',
        'INSPECTION_SCHEDULED',
        'INSPECTION_OVERDUE',
        'HIGH_RISK_DETECTED',
        'REGIONAL_CLUSTER_DETECTED',
        'ANOMALY_DETECTED',
        'NOTICE_DEADLINE_APPROACHING',
        'OPERATIONAL_BROADCAST'
      ]
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'WARNING', 'HIGH', 'CRITICAL'],
      default: 'INFO'
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedEntityType: { type: String },
    relatedEntityId: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    fingerprint: { type: String, required: true }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, fingerprint: 1 }, { unique: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
