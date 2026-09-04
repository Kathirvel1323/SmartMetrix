import mongoose, { Schema, Document } from 'mongoose';

export interface IDemoBatch extends Document {
  batchId: string;
  idempotencyKey: string;
  seed?: string;
  count: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
  recordCounts: {
    users?: number;
    instruments?: number;
    verificationRequests?: number;
    inspections?: number;
    certificates?: number;
    complaints?: number;
    improvementNotices?: number;
  };
  createdRecordIds: {
    users?: mongoose.Types.ObjectId[];
    instruments?: mongoose.Types.ObjectId[];
    verificationRequests?: mongoose.Types.ObjectId[];
    inspections?: mongoose.Types.ObjectId[];
    certificates?: mongoose.Types.ObjectId[];
    complaints?: mongoose.Types.ObjectId[];
    improvementNotices?: mongoose.Types.ObjectId[];
  };
  errorSummary?: string;
  createdAt: Date;
}

const DemoBatchSchema: Schema = new Schema(
  {
    batchId: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    seed: { type: String },
    count: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED'],
      default: 'PENDING'
    },
    recordCounts: {
      users: { type: Number, default: 0 },
      instruments: { type: Number, default: 0 },
      verificationRequests: { type: Number, default: 0 },
      inspections: { type: Number, default: 0 },
      certificates: { type: Number, default: 0 },
      complaints: { type: Number, default: 0 },
      improvementNotices: { type: Number, default: 0 }
    },
    createdRecordIds: {
      users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      instruments: [{ type: Schema.Types.ObjectId, ref: 'Instrument' }],
      verificationRequests: [{ type: Schema.Types.ObjectId, ref: 'VerificationRequest' }],
      inspections: [{ type: Schema.Types.ObjectId, ref: 'Inspection' }],
      certificates: [{ type: Schema.Types.ObjectId, ref: 'Certificate' }],
      complaints: [{ type: Schema.Types.ObjectId, ref: 'Complaint' }],
      improvementNotices: [{ type: Schema.Types.ObjectId, ref: 'ImprovementNotice' }]
    },
    errorSummary: { type: String }
  },
  { timestamps: true }
);

export const DemoBatch = mongoose.model<IDemoBatch>('DemoBatch', DemoBatchSchema);
