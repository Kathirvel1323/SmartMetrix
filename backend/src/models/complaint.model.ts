import mongoose, { Document, Schema, Model } from 'mongoose';

export type ComplaintCategory =
  | 'ACCURACY_DOUBT'
  | 'SEAL_BROKEN'
  | 'EXPIRED_CERTIFICATE'
  | 'TAMPERING_SUSPECTED'
  | 'OTHER';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'DISMISSED';

export interface IComplaintStatusEvent {
  status: ComplaintStatus;
  timestamp: Date;
  changedBy?: mongoose.Types.ObjectId;
  remarks?: string;
}

export interface IComplaint extends Document {
  complaintId: string;
  trackingToken: string; // unguessable UUID v4 token
  certificate: mongoose.Types.ObjectId;
  instrument: mongoose.Types.ObjectId;
  publicVerificationId: string;
  category: ComplaintCategory;
  description: string;

  // Encrypted at rest via AES-256-GCM
  encryptedContact?: {
    iv: string;
    authTag: string;
    encryptedData: string;
  };

  status: ComplaintStatus;
  submittedAt: Date;
  assignedTo?: mongoose.Types.ObjectId;
  resolutionSummary?: string;

  statusHistory: IComplaintStatusEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const complaintStatusSchema = new Schema<IComplaintStatusEvent>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, trim: true }
  },
  { _id: false }
);

const complaintSchema = new Schema<IComplaint>(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    trackingToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    certificate: {
      type: Schema.Types.ObjectId,
      ref: 'Certificate',
      required: true
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    publicVerificationId: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ['ACCURACY_DOUBT', 'SEAL_BROKEN', 'EXPIRED_CERTIFICATE', 'TAMPERING_SUSPECTED', 'OTHER']
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000
    },
    encryptedContact: {
      iv: { type: String },
      authTag: { type: String },
      encryptedData: { type: String }
    },
    status: {
      type: String,
      required: true,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'],
      default: 'SUBMITTED',
      index: true
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    resolutionSummary: {
      type: String,
      trim: true
    },
    statusHistory: {
      type: [complaintStatusSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Complaint: Model<IComplaint> =
  mongoose.model<IComplaint>('Complaint', complaintSchema);
