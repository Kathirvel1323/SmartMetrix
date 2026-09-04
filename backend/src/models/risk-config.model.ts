import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Configurable factor weights for risk scoring.
 * All 9 weights must sum exactly to 100 (enforced in service layer).
 */
export interface IRiskWeights {
  deviation: number;
  failedInspections: number;
  complaints: number;
  repairs: number;
  overdueCertificate: number;
  nonComplianceHistory: number;
  age: number;
  calibrationIssues: number;
  regionalRisk: number;
}

/**
 * Risk level thresholds: scores are in range [0, 100].
 * Must be ordered: LOW.max < MEDIUM.max < HIGH.max == 100.
 */
export interface IRiskThresholds {
  LOW: { min: number; max: number };
  MEDIUM: { min: number; max: number };
  HIGH: { min: number; max: number };
  CRITICAL: { min: number; max: number };
}

export type MissingDataStrategy = 'RENORMALIZE' | 'ZERO';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IRiskConfiguration extends Document {
  configId: string;
  name: string;
  weights: IRiskWeights;
  thresholds: IRiskThresholds;
  missingDataStrategy: MissingDataStrategy;
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WEIGHT_FIELDS = [
  'deviation',
  'failedInspections',
  'complaints',
  'repairs',
  'overdueCertificate',
  'nonComplianceHistory',
  'age',
  'calibrationIssues',
  'regionalRisk'
] as const;

const weightFieldDef = {
  type: Number,
  required: true,
  min: [0, 'Weight must be >= 0'],
  max: [100, 'Weight must be <= 100']
};

const riskConfigSchema = new Schema<IRiskConfiguration>(
  {
    configId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    weights: {
      deviation: { ...weightFieldDef },
      failedInspections: { ...weightFieldDef },
      complaints: { ...weightFieldDef },
      repairs: { ...weightFieldDef },
      overdueCertificate: { ...weightFieldDef },
      nonComplianceHistory: { ...weightFieldDef },
      age: { ...weightFieldDef },
      calibrationIssues: { ...weightFieldDef },
      regionalRisk: { ...weightFieldDef }
    },
    thresholds: {
      LOW: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      },
      MEDIUM: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      },
      HIGH: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      },
      CRITICAL: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
      }
    },
    missingDataStrategy: {
      type: String,
      enum: ['RENORMALIZE', 'ZERO'],
      default: 'RENORMALIZE',
      required: true
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1
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

// Partial unique index: only one document may have isActive === true at a time.
// This provides a best-effort DB guard; the service also enforces this atomically.
riskConfigSchema.index(
  { isActive: 1 },
  {
    name: 'unique_active_risk_config',
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

export const RISK_WEIGHT_FIELDS: readonly string[] = WEIGHT_FIELDS;

export const RiskConfiguration: Model<IRiskConfiguration> = mongoose.model<IRiskConfiguration>(
  'RiskConfiguration',
  riskConfigSchema
);
