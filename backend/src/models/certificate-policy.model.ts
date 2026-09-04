import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICertificatePolicy extends Document {
  policyId: string;
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  validityPeriodMonths: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const certificatePolicySchema = new Schema<ICertificatePolicy>(
  {
    policyId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    instrumentType: {
      type: String,
      required: true,
      trim: true
    },
    instrumentCategory: {
      type: String,
      required: true,
      trim: true
    },
    validityPeriodMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
      default: 12
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
      required: true
    },
    effectiveTo: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    version: {
      type: Number,
      default: 1
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

// Prevent ambiguous overlapping active policies for same type + category
certificatePolicySchema.index(
  { instrumentType: 1, instrumentCategory: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const CertificatePolicy: Model<ICertificatePolicy> =
  mongoose.model<ICertificatePolicy>('CertificatePolicy', certificatePolicySchema);
