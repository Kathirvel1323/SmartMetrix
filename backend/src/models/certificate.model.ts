import mongoose, { Document, Schema, Model } from 'mongoose';

export type CertificateStatus = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';

export interface IRevocationHistoryEvent {
  status: CertificateStatus;
  timestamp: Date;
  changedBy: mongoose.Types.ObjectId;
  reason: string;
}

export interface ICertificate extends Document {
  certificateNumber: string;
  publicVerificationId: string; // UUID v4 unguessable string
  instrument: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  verificationRequest: mongoose.Types.ObjectId;
  inspection: mongoose.Types.ObjectId;

  // Safe snapshots
  instrumentSnapshot: {
    instrumentId: string;
    type: string;
    category: string;
    manufacturer: string;
    model: string;
    maskedSerialNumber: string;
    capacity: { value: number; unit: string };
  };
  verificationSnapshot: {
    requestId: string;
    verificationType: string;
  };
  inspectionSnapshot: {
    inspectionId: string;
    inspectorResult: string;
    calculatedAssessment: string;
    referenceReading: number;
    actualReading: number;
    deviation: number;
    deviationPercentage: number | null;
  };

  verificationDate: Date;
  issuedAt: Date;
  validFrom: Date;
  expiresAt: Date;
  status: CertificateStatus;

  policySnapshot: {
    policyId: string;
    name: string;
    validityPeriodMonths: number;
    version: number;
  };

  // Integrity metadata
  integrityMetadata: {
    payloadHash: string;
    hmacSeal: string;
    algorithm: string;
    label: string;
  };

  revocationHistory: IRevocationHistoryEvent[];

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const revocationHistorySchema = new Schema<IRevocationHistoryEvent>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const certificateSchema = new Schema<ICertificate>(
  {
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    publicVerificationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    verificationRequest: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationRequest',
      required: true,
      unique: true, // Database-enforced exactly one certificate per verification request
      index: true
    },
    inspection: {
      type: Schema.Types.ObjectId,
      ref: 'Inspection',
      required: true
    },
    instrumentSnapshot: {
      instrumentId: { type: String, required: true },
      type: { type: String, required: true },
      category: { type: String, required: true },
      manufacturer: { type: String, required: true },
      model: { type: String, required: true },
      maskedSerialNumber: { type: String, required: true },
      capacity: {
        value: { type: Number, required: true },
        unit: { type: String, required: true }
      }
    },
    verificationSnapshot: {
      requestId: { type: String, required: true },
      verificationType: { type: String, required: true }
    },
    inspectionSnapshot: {
      inspectionId: { type: String, required: true },
      inspectorResult: { type: String, required: true },
      calculatedAssessment: { type: String, required: true },
      referenceReading: { type: Number, required: true },
      actualReading: { type: Number, required: true },
      deviation: { type: Number, required: true },
      deviationPercentage: { type: Number, default: null }
    },
    verificationDate: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    validFrom: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['VALID', 'EXPIRED', 'REVOKED', 'SUPERSEDED'],
      default: 'VALID',
      index: true
    },
    policySnapshot: {
      policyId: { type: String, required: true },
      name: { type: String, required: true },
      validityPeriodMonths: { type: Number, required: true },
      version: { type: Number, required: true }
    },
    integrityMetadata: {
      payloadHash: { type: String, required: true },
      hmacSeal: { type: String, required: true },
      algorithm: { type: String, default: 'HMAC-SHA256' },
      label: { type: String, default: 'tamper-evident integrity metadata' }
    },
    revocationHistory: {
      type: [revocationHistorySchema],
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

certificateSchema.index({ instrument: 1, status: 1, expiresAt: -1 });

export const Certificate: Model<ICertificate> =
  mongoose.model<ICertificate>('Certificate', certificateSchema);
