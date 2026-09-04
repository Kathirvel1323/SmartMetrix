import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPredictiveAssessment extends Document {
  assessmentId: string;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA';
  slope: number | null;
  sampleCount: number;
  evidence: string[];
  dataCoverage: number;
  attentionRecommendation: string;
  disclaimer: string;
  assessedBy: mongoose.Types.ObjectId;
  assessedAt: Date;
}

const predictiveAssessmentSchema = new Schema<IPredictiveAssessment>(
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
    status: {
      type: String,
      required: true,
      enum: ['SUCCESS', 'INSUFFICIENT_DATA']
    },
    trendDirection: {
      type: String,
      required: true,
      enum: ['IMPROVING', 'STABLE', 'WORSENING', 'INSUFFICIENT_DATA']
    },
    slope: {
      type: Number,
      default: null
    },
    sampleCount: {
      type: Number,
      required: true
    },
    evidence: {
      type: [String],
      default: []
    },
    dataCoverage: {
      type: Number,
      required: true
    },
    attentionRecommendation: {
      type: String,
      required: true
    },
    disclaimer: {
      type: String,
      required: true,
      default: 'Decision support output only. NEVER call it legal failure prediction or override statutory inspection status.'
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

predictiveAssessmentSchema.index({ instrument: 1, assessedAt: -1 });

export const PredictiveAssessment: Model<IPredictiveAssessment> =
  mongoose.model<IPredictiveAssessment>('PredictiveAssessment', predictiveAssessmentSchema);
