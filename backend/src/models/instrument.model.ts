import mongoose, { Document, Schema, Model } from 'mongoose';

export type InstrumentStatus =
  | 'REGISTERED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'UNDER_VERIFICATION'
  | 'SUSPENDED'
  | 'DECOMMISSIONED';

export interface ILifecycleEvent {
  eventType: string;
  timestamp: Date;
  performedBy: mongoose.Types.ObjectId;
  description: string;
  metadata?: Record<string, any>;
}

export interface ICurrentCertificate {
  certificateNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  verifierId?: mongoose.Types.ObjectId;
}

export interface ILocation {
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface ICapacity {
  value: number;
  unit: string;
}

export interface IInstrument {
  _id?: mongoose.Types.ObjectId;
  instrumentId: string;
  owner: mongoose.Types.ObjectId;
  type: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity: ICapacity;
  accuracyClass?: string;
  location: ILocation;
  status: InstrumentStatus;
  currentCertificate?: ICurrentCertificate;
  lifecycleHistory: ILifecycleEvent[];
  isArchived: boolean;
  archivedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lifecycleEventSchema = new Schema<ILifecycleEvent>(
  {
    eventType: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { _id: false }
);

const currentCertificateSchema = new Schema<ICurrentCertificate>(
  {
    certificateNumber: { type: String, trim: true },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    verifierId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const instrumentSchema = new Schema<IInstrument>(
  {
    instrumentId: {
      type: String,
      required: [true, 'Instrument ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Instrument type is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Instrument category is required'],
      trim: true
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true
    },
    serialNumber: {
      type: String,
      required: [true, 'Serial number is required'],
      trim: true
    },
    capacity: {
      value: {
        type: Number,
        required: [true, 'Capacity value is required'],
        min: [0.000001, 'Capacity must be greater than zero']
      },
      unit: {
        type: String,
        required: [true, 'Capacity unit is required'],
        trim: true,
        enum: {
          values: ['kg', 'g', 'mg', 't', 'l', 'ml', 'm', 'mm'],
          message: '{VALUE} is not a supported unit. Allowed: kg, g, mg, t, l, ml, m, mm'
        }
      }
    },
    accuracyClass: {
      type: String,
      trim: true
    },
    location: {
      address: {
        type: String,
        required: [true, 'Location address is required'],
        trim: true
      },
      city: {
        type: String,
        required: [true, 'Location city is required'],
        trim: true
      },
      district: {
        type: String,
        required: [true, 'Location district is required'],
        trim: true
      },
      state: {
        type: String,
        required: [true, 'Location state is required'],
        trim: true
      },
      pincode: {
        type: String,
        required: [true, 'Location pincode is required'],
        trim: true,
        match: [/^\d{6}$/, 'Pincode must be a 6-digit number']
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
          required: true
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
          validate: {
            validator: (coords: number[]) => {
              if (!Array.isArray(coords) || coords.length !== 2) return false;
              const [lon, lat] = coords;
              return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
            },
            message: 'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]'
          }
        }
      }
    },
    status: {
      type: String,
      enum: {
        values: [
          'REGISTERED',
          'ACTIVE',
          'INACTIVE',
          'UNDER_VERIFICATION',
          'SUSPENDED',
          'DECOMMISSIONED'
        ],
        message: '{VALUE} is not a valid instrument status'
      },
      default: 'REGISTERED',
      index: true
    },
    currentCertificate: {
      type: currentCertificateSchema,
      default: undefined
    },
    lifecycleHistory: {
      type: [lifecycleEventSchema],
      default: []
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    archivedAt: {
      type: Date
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

// Indexes
// 1. Case-insensitive compound uniqueness for manufacturer + serialNumber
instrumentSchema.index(
  { manufacturer: 1, serialNumber: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 }
  }
);

// 2. 2dsphere index on GeoJSON coordinates
instrumentSchema.index({ 'location.coordinates': '2dsphere' });

export const Instrument: Model<IInstrument> = mongoose.model<IInstrument>(
  'Instrument',
  instrumentSchema
);
