import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRegionalWeights {
  haversineDistance: number;   // 30
  typeCategory: number;        // 20
  manufacturerModel: number;   // 15
  ageCapacity: number;         // 10
  deviation: number;           // 10
  complaints: number;          // 5
  repairs: number;             // 5
  inspectionHistory: number;   // 5
}

export const REGIONAL_WEIGHT_FIELDS = [
  'haversineDistance',
  'typeCategory',
  'manufacturerModel',
  'ageCapacity',
  'deviation',
  'complaints',
  'repairs',
  'inspectionHistory'
] as const;

export interface IRegionalConfig extends Document {
  configId: string;
  name: string;
  weights: IRegionalWeights;
  similarityThresholds: {
    clusterThreshold: number;      // e.g. 75
    correlationThreshold: number;  // e.g. 60
    riskPatternThreshold: number;  // e.g. 45
  };
  allowedRadiiKm: number[]; // [5, 10, 25]
  defaultRadiusKm: number;  // 10
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const regionalWeightsSchema = new Schema<IRegionalWeights>(
  {
    haversineDistance: { type: Number, required: true, min: 0, max: 100, default: 30 },
    typeCategory: { type: Number, required: true, min: 0, max: 100, default: 20 },
    manufacturerModel: { type: Number, required: true, min: 0, max: 100, default: 15 },
    ageCapacity: { type: Number, required: true, min: 0, max: 100, default: 10 },
    deviation: { type: Number, required: true, min: 0, max: 100, default: 10 },
    complaints: { type: Number, required: true, min: 0, max: 100, default: 5 },
    repairs: { type: Number, required: true, min: 0, max: 100, default: 5 },
    inspectionHistory: { type: Number, required: true, min: 0, max: 100, default: 5 }
  },
  { _id: false }
);

const regionalConfigSchema = new Schema<IRegionalConfig>(
  {
    configId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Configuration name is required'],
      trim: true
    },
    weights: {
      type: regionalWeightsSchema,
      required: true
    },
    similarityThresholds: {
      clusterThreshold: { type: Number, required: true, default: 75 },
      correlationThreshold: { type: Number, required: true, default: 60 },
      riskPatternThreshold: { type: Number, required: true, default: 45 }
    },
    allowedRadiiKm: {
      type: [Number],
      default: [5, 10, 25]
    },
    defaultRadiusKm: {
      type: Number,
      default: 10
    },
    isActive: {
      type: Boolean,
      default: false
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

regionalConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const RegionalConfig: Model<IRegionalConfig> = mongoose.model<IRegionalConfig>(
  'RegionalConfig',
  regionalConfigSchema
);
