import mongoose, { Document, Schema, Model } from 'mongoose';

export type AnomalyMethod = 'ISOLATION_FOREST' | 'DETERMINISTIC_STATISTICAL_FALLBACK' | 'INSUFFICIENT_DATA';
export type AnomalyStatus = 'POTENTIAL_ANOMALY' | 'NORMAL' | 'INSUFFICIENT_DATA';

export interface IFeatureBreakdown {
  name: string;
  value: number | null;
  available: boolean;
  explanation: string;
}

export interface IModelMetadata {
  algorithm: string;
  version: string;
  sampleCount: number;
  contamination?: number;
  randomState?: number;
  featuresUsed: string[];
}

export interface IAnomalyAssessment extends Document {
  assessmentId: string;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;

  // Analysis result
  method: AnomalyMethod;
  status: AnomalyStatus;
  potentialAnomaly: boolean;
  anomalyScore: number | null; // 0 to 1 (higher = more anomalous) or null if INSUFFICIENT_DATA
  confidence: number | null; // 0 to 1

  // Explainability & Features
  features: IFeatureBreakdown[];
  dataCoverage: number; // 0 to 1
  contributingFactors: string[];
  modelMetadata: IModelMetadata;

  // Decision support disclaimer
  disclaimer: string;

  assessedBy: mongoose.Types.ObjectId;
  assessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const featureBreakdownSchema = new Schema<IFeatureBreakdown>(
  {
    name: { type: String, required: true },
    value: { type: Number, default: null },
    available: { type: Boolean, required: true },
    explanation: { type: String, required: true }
  },
  { _id: false }
);

const modelMetadataSchema = new Schema<IModelMetadata>(
  {
    algorithm: { type: String, required: true },
    version: { type: String, required: true },
    sampleCount: { type: Number, required: true },
    contamination: { type: Number },
    randomState: { type: Number },
    featuresUsed: { type: [String], default: [] }
  },
  { _id: false }
);

const anomalyAssessmentSchema = new Schema<IAnomalyAssessment>(
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
    method: {
      type: String,
      required: true,
      enum: ['ISOLATION_FOREST', 'DETERMINISTIC_STATISTICAL_FALLBACK', 'INSUFFICIENT_DATA']
    },
    status: {
      type: String,
      required: true,
      enum: ['POTENTIAL_ANOMALY', 'NORMAL', 'INSUFFICIENT_DATA'],
      index: true
    },
    potentialAnomaly: {
      type: Boolean,
      required: true,
      index: true
    },
    anomalyScore: {
      type: Number,
      default: null,
      min: 0,
      max: 1
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1
    },
    features: {
      type: [featureBreakdownSchema],
      default: []
    },
    dataCoverage: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    contributingFactors: {
      type: [String],
      default: []
    },
    modelMetadata: {
      type: modelMetadataSchema,
      required: true
    },
    disclaimer: {
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

// Compound index for querying latest assessment per instrument
anomalyAssessmentSchema.index({ instrument: 1, assessedAt: -1 });

export const AnomalyAssessment: Model<IAnomalyAssessment> = mongoose.model<IAnomalyAssessment>(
  'AnomalyAssessment',
  anomalyAssessmentSchema
);
