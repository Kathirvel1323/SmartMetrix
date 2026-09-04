import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPhotoAssistAssessment extends Document {
  assessmentId: string;
  inspection?: mongoose.Types.ObjectId;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;
  qualityMetrics: {
    resolution: { width: number; height: number };
    brightnessScore: number;
    contrastScore: number;
    sharpnessScore: number;
    overallQualityScore: number;
  };
  semanticFields: {
    seal_intact: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    model_plate_legible: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    serial_number_match: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    tampering_detected: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
  };
  irregularities: string[];
  disclaimer: string;
  assessedBy: mongoose.Types.ObjectId;
  assessedAt: Date;
}

const photoAssistSchema = new Schema<IPhotoAssistAssessment>(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    inspection: {
      type: Schema.Types.ObjectId,
      ref: 'Inspection'
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
    qualityMetrics: {
      resolution: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      },
      brightnessScore: { type: Number, required: true },
      contrastScore: { type: Number, required: true },
      sharpnessScore: { type: Number, required: true },
      overallQualityScore: { type: Number, required: true }
    },
    semanticFields: {
      seal_intact: { type: String, default: 'NOT_ASSESSED' },
      model_plate_legible: { type: String, default: 'MANUAL_REVIEW_REQUIRED' },
      serial_number_match: { type: String, default: 'NOT_ASSESSED' },
      tampering_detected: { type: String, default: 'NOT_ASSESSED' }
    },
    irregularities: {
      type: [String],
      default: []
    },
    disclaimer: {
      type: String,
      required: true,
      default: 'Decision support output only. Does not alter statutory inspection results or constitute legal proof of defect or tampering.'
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

photoAssistSchema.index({ instrument: 1, assessedAt: -1 });

export const PhotoAssistAssessment: Model<IPhotoAssistAssessment> =
  mongoose.model<IPhotoAssistAssessment>('PhotoAssistAssessment', photoAssistSchema);
