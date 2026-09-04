import mongoose, { Document, Schema, Model } from 'mongoose';

export type ToleranceMode = 'ABSOLUTE' | 'PERCENTAGE';

export interface IToleranceRule extends Document {
  ruleId: string;
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  capacityMin: number;
  capacityMax: number;
  capacityUnit: string;
  toleranceMode: ToleranceMode;
  toleranceValue: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const toleranceRuleSchema = new Schema<IToleranceRule>(
  {
    ruleId: {
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
    capacityMin: {
      type: Number,
      required: true,
      min: 0
    },
    capacityMax: {
      type: Number,
      required: true
    },
    capacityUnit: {
      type: String,
      required: true,
      trim: true
    },
    toleranceMode: {
      type: String,
      required: true,
      enum: ['ABSOLUTE', 'PERCENTAGE']
    },
    toleranceValue: {
      type: Number,
      required: true,
      min: 0
    },
    effectiveFrom: {
      type: Date,
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

// Compound index for rule lookup during inspection
toleranceRuleSchema.index({ instrumentType: 1, instrumentCategory: 1, isActive: 1 });
toleranceRuleSchema.index({ capacityUnit: 1, capacityMin: 1, capacityMax: 1 });

export const ToleranceRule: Model<IToleranceRule> = mongoose.model<IToleranceRule>(
  'ToleranceRule',
  toleranceRuleSchema
);
