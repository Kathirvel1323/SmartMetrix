import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  auditId: string;
  timestamp: Date;
  actor: {
    userId: string;
    role: string;
    email?: string;
  };
  action: string;
  entityType: string;
  entityId: string;
  httpMethod?: string;
  path?: string;
  resultStatus: 'SUCCESS' | 'FAILURE';
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  previousStateSummary?: Record<string, any>;
  changedStateSummary?: Record<string, any>;
}

const AuditLogSchema: Schema = new Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    actor: {
      userId: { type: String, required: true, index: true },
      role: { type: String, required: true },
      email: { type: String }
    },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    httpMethod: { type: String },
    path: { type: String },
    resultStatus: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    previousStateSummary: { type: Schema.Types.Mixed },
    changedStateSummary: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

// Append-only constraint logic on model level
AuditLogSchema.pre('updateOne', function () {
  throw new Error('AuditLog is append-only and cannot be updated.');
});
AuditLogSchema.pre('updateMany', function () {
  throw new Error('AuditLog is append-only and cannot be updated.');
});
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog is append-only and cannot be updated.');
});
AuditLogSchema.pre('deleteOne', function () {
  if (this.getOptions()?.bypassImmutable) return;
  throw new Error('AuditLog is append-only and cannot be deleted.');
});
AuditLogSchema.pre('deleteMany', function () {
  if (this.getOptions()?.bypassImmutable) return;
  throw new Error('AuditLog is append-only and cannot be deleted.');
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
