import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFacilityProfile {
  facilityId: string;
  name: string;
  location: {
    city: string;
    state: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number]; // [lon, lat]
    };
  };
  availableEquipment: string[];
  maxDailyCapacity: number;
}

export interface IVerificationMethodRule extends Document {
  ruleId: string;
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  verificationMethod: string;
  requiredEquipment: string[];
  estimatedEffortHours: number;
  authorizedFacilityProfiles: IFacilityProfile[];
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const facilityProfileSchema = new Schema<IFacilityProfile>(
  {
    facilityId: { type: String, required: true },
    name: { type: String, required: true },
    location: {
      city: { type: String, required: true },
      state: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }
      }
    },
    availableEquipment: [{ type: String }],
    maxDailyCapacity: { type: Number, default: 10 }
  },
  { _id: false }
);

const verificationMethodRuleSchema = new Schema<IVerificationMethodRule>(
  {
    ruleId: {
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
    verificationMethod: {
      type: String,
      required: true,
      trim: true
    },
    requiredEquipment: {
      type: [String],
      required: true
    },
    estimatedEffortHours: {
      type: Number,
      default: 2
    },
    authorizedFacilityProfiles: {
      type: [facilityProfileSchema],
      default: []
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

export const VerificationMethodRule: Model<IVerificationMethodRule> =
  mongoose.model<IVerificationMethodRule>('VerificationMethodRule', verificationMethodRuleSchema);
