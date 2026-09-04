import mongoose, { Document, Schema, Model } from 'mongoose';

export type NoticeStatus =
  | 'OPEN'
  | 'CORRECTION_IN_PROGRESS'
  | 'REINSPECTION_PENDING'
  | 'CLOSED'
  | 'ESCALATED';

export interface INoticeStatusEvent {
  status: NoticeStatus;
  timestamp: Date;
  changedBy: mongoose.Types.ObjectId;
  remarks?: string;
}

export interface IImprovementNotice extends Document {
  noticeId: string;
  instrument: mongoose.Types.ObjectId;
  inspection: mongoose.Types.ObjectId;
  issuedBy: mongoose.Types.ObjectId;
  reason: string;
  issueDate: Date;
  deadline: Date;
  requiredCorrection: string;
  status: NoticeStatus;
  reInspectionDate?: Date;
  closureRemarks?: string;
  statusHistory: INoticeStatusEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const noticeStatusSchema = new Schema<INoticeStatusEvent>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: { type: String, trim: true }
  },
  { _id: false }
);

const improvementNoticeSchema = new Schema<IImprovementNotice>(
  {
    noticeId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    inspection: {
      type: Schema.Types.ObjectId,
      ref: 'Inspection',
      required: true
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    issueDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    deadline: {
      type: Date,
      required: true,
      index: true
    },
    requiredCorrection: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'CORRECTION_IN_PROGRESS', 'REINSPECTION_PENDING', 'CLOSED', 'ESCALATED'],
      default: 'OPEN',
      index: true
    },
    reInspectionDate: {
      type: Date
    },
    closureRemarks: {
      type: String,
      trim: true
    },
    statusHistory: {
      type: [noticeStatusSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const ImprovementNotice: Model<IImprovementNotice> =
  mongoose.model<IImprovementNotice>('ImprovementNotice', improvementNoticeSchema);
