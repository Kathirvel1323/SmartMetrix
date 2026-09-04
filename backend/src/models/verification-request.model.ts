import mongoose, { Document, Schema, Model } from 'mongoose';

export type VerificationType = 'INITIAL' | 'RE_VERIFICATION';

export type VerificationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ASSIGNED'
  | 'SCHEDULED'
  | 'INSPECTION_COMPLETED'
  | 'PASSED'
  | 'FAILED'
  | 'CERTIFICATE_ISSUED'
  | 'CLOSED';

export interface IStatusHistoryEvent {
  status: VerificationStatus;
  timestamp: Date;
  changedBy: mongoose.Types.ObjectId;
  remarks?: string;
  metadata?: Record<string, any>;
}

export interface IVerificationRequest extends Document {
  requestId: string;
  instrument: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  verificationType: VerificationType;
  remarks?: string;
  status: VerificationStatus;
  submittedAt: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  assignedInspector?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  scheduledAt?: Date;
  estimatedDurationMinutes?: number;
  scheduleLocation?: string;
  scheduleNotes?: string;
  statusHistory: IStatusHistoryEvent[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new Schema<IStatusHistoryEvent>(
  {
    status: {
      type: String,
      required: true,
      enum: [
        'SUBMITTED',
        'UNDER_REVIEW',
        'ASSIGNED',
        'SCHEDULED',
        'INSPECTION_COMPLETED',
        'PASSED',
        'FAILED',
        'CERTIFICATE_ISSUED',
        'CLOSED'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    remarks: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { _id: false }
);

const verificationRequestSchema = new Schema<IVerificationRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    verificationType: {
      type: String,
      required: true,
      enum: ['INITIAL', 'RE_VERIFICATION']
    },
    remarks: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: [
        'SUBMITTED',
        'UNDER_REVIEW',
        'ASSIGNED',
        'SCHEDULED',
        'INSPECTION_COMPLETED',
        'PASSED',
        'FAILED',
        'CERTIFICATE_ISSUED',
        'CLOSED'
      ],
      default: 'SUBMITTED',
      index: true
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewRemarks: {
      type: String,
      trim: true
    },
    assignedInspector: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    },
    scheduledAt: {
      type: Date,
      index: true
    },
    estimatedDurationMinutes: {
      type: Number,
      min: 15,
      max: 480
    },
    scheduleLocation: {
      type: String,
      trim: true
    },
    scheduleNotes: {
      type: String,
      trim: true
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Database-enforced uniqueness: only one active verification request allowed per instrument
// Terminal statuses (FAILED, CLOSED) do not block future requests.
verificationRequestSchema.index(
  { instrument: 1 },
  {
    name: 'unique_active_verification_per_instrument',
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          'SUBMITTED',
          'UNDER_REVIEW',
          'ASSIGNED',
          'SCHEDULED',
          'INSPECTION_COMPLETED',
          'PASSED',
          'CERTIFICATE_ISSUED'
        ]
      }
    }
  }
);

// Compound index for inspector schedule conflict checks
verificationRequestSchema.index({ assignedInspector: 1, status: 1, scheduledAt: 1 });

export const VerificationRequest: Model<IVerificationRequest> =
  mongoose.model<IVerificationRequest>('VerificationRequest', verificationRequestSchema);
