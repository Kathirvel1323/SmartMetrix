import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISimilarInstrumentMatch {
  instrumentId: string;
  distanceKm: number;
  similarityScore: number;
  commonFactors: string[];
  type: string;
  category: string;
  manufacturer: string;
  model: string;
}

export interface IRegionalCorrelationAssessment extends Document {
  assessmentId: string;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;
  radiusKm: number;
  configSnapshot: {
    configId: string;
    weights: Record<string, number>;
    version: number;
  };
  similarInstruments: ISimilarInstrumentMatch[];
  averageSimilarityScore: number;
  highestSimilarityScore: number;
  patternType: 'Potential Cluster' | 'Correlation' | 'Risk Pattern' | 'INSUFFICIENT_DATA';
  missingFactors: string[];
  dataCoverage: number; // 0-100%
  recommendedAction: string;
  disclaimer: string;
  assessedBy: mongoose.Types.ObjectId;
  assessedAt: Date;
}

const similarInstrumentMatchSchema = new Schema<ISimilarInstrumentMatch>(
  {
    instrumentId: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    similarityScore: { type: Number, required: true },
    commonFactors: [{ type: String }],
    type: { type: String, required: true },
    category: { type: String, required: true },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true }
  },
  { _id: false }
);

const regionalCorrelationSchema = new Schema<IRegionalCorrelationAssessment>(
  {
    assessmentId: {
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
    instrumentIdSnapshot: {
      type: String,
      required: true,
      trim: true
    },
    radiusKm: {
      type: Number,
      required: true,
      enum: [5, 10, 25]
    },
    configSnapshot: {
      configId: { type: String, required: true },
      weights: { type: Schema.Types.Mixed, required: true },
      version: { type: Number, required: true }
    },
    similarInstruments: {
      type: [similarInstrumentMatchSchema],
      default: []
    },
    averageSimilarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    highestSimilarityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    patternType: {
      type: String,
      required: true,
      enum: ['Potential Cluster', 'Correlation', 'Risk Pattern', 'INSUFFICIENT_DATA']
    },
    missingFactors: {
      type: [String],
      default: []
    },
    dataCoverage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    recommendedAction: {
      type: String,
      required: true
    },
    disclaimer: {
      type: String,
      required: true,
      default: 'Decision support output only. Does not constitute legal proof or confirmation of fraud, defect, or tampering.'
    },
    assessedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assessedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

regionalCorrelationSchema.index({ instrument: 1, assessedAt: -1 });

export const RegionalCorrelationAssessment: Model<IRegionalCorrelationAssessment> =
  mongoose.model<IRegionalCorrelationAssessment>('RegionalCorrelationAssessment', regionalCorrelationSchema);
