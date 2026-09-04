import mongoose, { Document, Schema, Model } from 'mongoose';
import { RiskLevel } from './risk-config.model';

export type TrustLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

/**
 * Per-factor contribution record for risk scoring.
 * available=false means the factor data was not present in the system
 * (e.g., no complaints module). It was never fabricated.
 */
export interface IRiskFactor {
  factor: string;
  available: boolean;
  rawValue: number | null;
  normalizedValue: number | null; // 0–1
  configuredWeight: number;
  effectiveWeight: number; // after renormalization (if RENORMALIZE strategy)
  contribution: number; // effectiveWeight * normalizedValue
}

export interface ITrustFactor {
  factor: string;
  available: boolean;
  value: number | null;
  impact: 'POSITIVE' | 'NEGATIVE';
  contribution: number; // absolute points contributed to trust score
  explanation: string;
}

export interface IRiskAssessment extends Document {
  assessmentId: string;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;

  // Immutable snapshot of the config used at assessment time
  configSnapshot: {
    configId: string;
    name: string;
    weights: Record<string, number>;
    thresholds: Record<string, { min: number; max: number }>;
    missingDataStrategy: string;
    version: number;
  };

  // Risk Score
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: IRiskFactor[];
  missingFactors: string[];
  dataCoverage: number; // fraction of weight-bearing factors with real data (0–1)
  recommendedAction: string;
  disclaimer: string;

  // Trust Score (separate, not aggregated with risk)
  trustScore: number;
  trustLevel: TrustLevel;
  trustFactors: ITrustFactor[];
  trustDataCoverage: number;
  trustExplanation: string;

  assessedBy: mongoose.Types.ObjectId;
  assessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const riskFactorSchema = new Schema<IRiskFactor>(
  {
    factor: { type: String, required: true },
    available: { type: Boolean, required: true },
    rawValue: { type: Number, default: null },
    normalizedValue: { type: Number, default: null },
    configuredWeight: { type: Number, required: true },
    effectiveWeight: { type: Number, required: true },
    contribution: { type: Number, required: true }
  },
  { _id: false }
);

const trustFactorSchema = new Schema<ITrustFactor>(
  {
    factor: { type: String, required: true },
    available: { type: Boolean, required: true },
    value: { type: Number, default: null },
    impact: { type: String, required: true, enum: ['POSITIVE', 'NEGATIVE'] },
    contribution: { type: Number, required: true },
    explanation: { type: String, required: true }
  },
  { _id: false }
);

const riskAssessmentSchema = new Schema<IRiskAssessment>(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    instrument: {
      type: Schema.Types.ObjectId,
      ref: 'Instrument',
      required: true,
      index: true
    },
    instrumentIdSnapshot: {
      type: String,
      required: true,
      trim: true
    },
    configSnapshot: {
      type: Schema.Types.Mixed,
      required: true
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    riskLevel: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    riskFactors: {
      type: [riskFactorSchema],
      default: []
    },
    missingFactors: {
      type: [String],
      default: []
    },
    dataCoverage: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    recommendedAction: {
      type: String,
      required: true
    },
    disclaimer: {
      type: String,
      required: true
    },
    trustScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    trustLevel: {
      type: String,
      required: true,
      enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
    },
    trustFactors: {
      type: [trustFactorSchema],
      default: []
    },
    trustDataCoverage: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    trustExplanation: {
      type: String,
      required: true
    },
    assessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assessedAt: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for latest assessment retrieval per instrument
riskAssessmentSchema.index({ instrument: 1, assessedAt: -1 });

export const RiskAssessment: Model<IRiskAssessment> = mongoose.model<IRiskAssessment>(
  'RiskAssessment',
  riskAssessmentSchema
);
