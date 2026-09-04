import mongoose, { Document, Schema, Model } from 'mongoose';

export type InspectorResult = 'PASS' | 'FAIL';
export type CalculatedAssessment = 'WITHIN_TOLERANCE' | 'OUTSIDE_TOLERANCE';
export type InspectionLifecycleStatus = 'PENDING' | 'FINALIZED' | 'FAILED';

export interface IEvidenceFile {
  evidenceId: string;
  originalMime: string;
  storedFilename?: string;
  sizeBytes: number;
  uploadedAt: Date;
  downloadUrl?: string;
}

export interface IToleranceSnapshot {
  ruleId: string;
  name: string;
  toleranceMode: 'ABSOLUTE' | 'PERCENTAGE';
  toleranceValue: number;
  capacityUnit: string;
}

export interface IGpsCapture {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  accuracy?: number;
  capturedAt?: Date;
}

export interface IInspection extends Document {
  inspectionId: string;
  instrument: mongoose.Types.ObjectId;
  instrumentIdSnapshot: string;
  verificationRequest: mongoose.Types.ObjectId;
  inspector: mongoose.Types.ObjectId;
  inspectionDate: Date;

  // Lifecycle status for failure-safe compensating workflow
  status: InspectionLifecycleStatus;

  // Readings
  referenceReading: number;
  actualReading: number;

  // Server-computed
  deviation: number;
  deviationPercentage: number | null;
  toleranceSnapshot: IToleranceSnapshot;
  calculatedAssessment: CalculatedAssessment;

  // Inspector final decision
  inspectorResult: InspectorResult;
  overrideReason?: string;

  // Physical condition observations
  sealCondition?: string;
  displayCondition?: string;
  physicalDamage?: string;
  nameplateCondition?: string;
  serialNumberMatch: boolean;
  potentialTamperingIndicators?: string;
  installationCondition?: string;
  remarks?: string;

  // Evidence
  evidence: IEvidenceFile[];

  // Location capture
  gps?: IGpsCapture;

  // Timestamps
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceFileSchema = new Schema<IEvidenceFile>(
  {
    evidenceId: { type: String, required: true },
    originalMime: { type: String, required: true },
    // Never select or expose storedFilename by default — server-side internal only
    storedFilename: { type: String, required: true, select: false },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const toleranceSnapshotSchema = new Schema<IToleranceSnapshot>(
  {
    ruleId: { type: String, required: true },
    name: { type: String, required: true },
    toleranceMode: { type: String, required: true, enum: ['ABSOLUTE', 'PERCENTAGE'] },
    toleranceValue: { type: Number, required: true },
    capacityUnit: { type: String, required: true }
  },
  { _id: false }
);

const gpsSchema = new Schema<IGpsCapture>(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coords: number[]) => {
          if (!Array.isArray(coords) || coords.length !== 2) return false;
          const [lon, lat] = coords;
          return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
        },
        message: 'GPS coordinates must be valid [longitude (-180–180), latitude (-90–90)]'
      }
    },
    accuracy: { type: Number, min: 0 },
    capturedAt: { type: Date }
  },
  { _id: false }
);

const inspectionSchema = new Schema<IInspection>(
  {
    inspectionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'FINALIZED', 'FAILED'],
      default: 'PENDING',
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
    verificationRequest: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationRequest',
      required: true,
      unique: true // One inspection per verification request — DB enforced
    },
    inspector: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    inspectionDate: {
      type: Date,
      required: true
    },
    referenceReading: {
      type: Number,
      required: true
    },
    actualReading: {
      type: Number,
      required: true
    },
    deviation: {
      type: Number,
      required: true
    },
    deviationPercentage: {
      type: Number,
      default: null
    },
    toleranceSnapshot: {
      type: toleranceSnapshotSchema,
      required: true
    },
    calculatedAssessment: {
      type: String,
      required: true,
      enum: ['WITHIN_TOLERANCE', 'OUTSIDE_TOLERANCE']
    },
    inspectorResult: {
      type: String,
      required: true,
      enum: ['PASS', 'FAIL']
    },
    overrideReason: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    sealCondition: { type: String, trim: true, maxlength: 500 },
    displayCondition: { type: String, trim: true, maxlength: 500 },
    physicalDamage: { type: String, trim: true, maxlength: 500 },
    nameplateCondition: { type: String, trim: true, maxlength: 500 },
    serialNumberMatch: {
      type: Boolean,
      required: true
    },
    potentialTamperingIndicators: { type: String, trim: true, maxlength: 1000 },
    installationCondition: { type: String, trim: true, maxlength: 500 },
    remarks: { type: String, trim: true, maxlength: 2000 },
    evidence: {
      type: [evidenceFileSchema],
      default: []
    },
    gps: {
      type: gpsSchema,
      default: undefined
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        if (Array.isArray(ret.evidence)) {
          ret.evidence = ret.evidence.map((e: any) => ({
            evidenceId: e.evidenceId,
            originalMime: e.originalMime,
            sizeBytes: e.sizeBytes,
            uploadedAt: e.uploadedAt,
            downloadUrl: `/api/inspections/${ret.inspectionId}/evidence/${e.evidenceId}`
          }));
        }
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret: any) => {
        if (Array.isArray(ret.evidence)) {
          ret.evidence = ret.evidence.map((e: any) => ({
            evidenceId: e.evidenceId,
            originalMime: e.originalMime,
            sizeBytes: e.sizeBytes,
            uploadedAt: e.uploadedAt,
            downloadUrl: `/api/inspections/${ret.inspectionId}/evidence/${e.evidenceId}`
          }));
        }
        return ret;
      }
    }
  }
);

export const Inspection: Model<IInspection> = mongoose.model<IInspection>(
  'Inspection',
  inspectionSchema
);
