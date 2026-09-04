import mongoose from 'mongoose';
import { Instrument, IInstrument, InstrumentStatus, ILifecycleEvent } from '../models/instrument.model';
import { User, IUser } from '../models/user.model';
import { generateInstrumentId } from '../utils/instrument-id.utils';

export interface RegisterInstrumentDTO {
  type: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity: {
    value: number;
    unit: string;
  };
  accuracyClass?: string;
  location: {
    address: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    coordinates: {
      type?: string;
      coordinates: [number, number]; // [lon, lat]
    };
  };
  ownerId?: string; // Only ADMIN can specify a different owner
}

export interface ListInstrumentsQuery {
  page?: number;
  limit?: number;
  status?: string;
  city?: string;
  type?: string;
  category?: string;
  includeArchived?: boolean;
}

export interface UpdateInstrumentDTO {
  model?: string;
  capacity?: {
    value: number;
    unit: string;
  };
  accuracyClass?: string;
  location?: {
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    coordinates?: {
      type?: string;
      coordinates: [number, number];
    };
  };
  status?: InstrumentStatus;
  type?: string;
  category?: string;
}

export class InstrumentService {
  /**
   * Registers a new legal metrology measuring instrument
   */
  async registerInstrument(data: RegisterInstrumentDTO, caller: IUser): Promise<IInstrument> {
    if (caller.role === 'INSPECTOR') {
      const error: any = new Error('Inspectors are not permitted to register instruments');
      error.statusCode = 403;
      throw error;
    }

    // Determine target owner
    let targetOwnerId: mongoose.Types.ObjectId;

    if (caller.role === 'OWNER') {
      // OWNER can only register for themselves
      targetOwnerId = caller._id as mongoose.Types.ObjectId;
    } else if (caller.role === 'ADMIN') {
      // ADMIN must supply a valid, active OWNER
      if (!data.ownerId || !mongoose.Types.ObjectId.isValid(data.ownerId)) {
        const error: any = new Error('Admin must provide a valid ownerId for instrument registration');
        error.statusCode = 400;
        throw error;
      }

      const targetOwner = await User.findById(data.ownerId);
      if (!targetOwner || !targetOwner.isActive || targetOwner.role !== 'OWNER') {
        const error: any = new Error('Referenced owner not found, deactivated, or does not have OWNER role');
        error.statusCode = 400;
        throw error;
      }

      targetOwnerId = targetOwner._id as mongoose.Types.ObjectId;
    } else {
      const error: any = new Error('Unauthorized to register instruments');
      error.statusCode = 403;
      throw error;
    }

    // Validate required fields
    const { type, category, manufacturer, model, serialNumber, capacity, location } = data;

    if (!type || !type.trim()) {
      const err: any = new Error('Instrument type is required');
      err.statusCode = 400;
      throw err;
    }

    if (!category || !category.trim()) {
      const err: any = new Error('Instrument category is required');
      err.statusCode = 400;
      throw err;
    }

    if (!manufacturer || !manufacturer.trim()) {
      const err: any = new Error('Manufacturer is required');
      err.statusCode = 400;
      throw err;
    }

    if (!model || !model.trim()) {
      const err: any = new Error('Model is required');
      err.statusCode = 400;
      throw err;
    }

    if (!serialNumber || !serialNumber.trim()) {
      const err: any = new Error('Serial number is required');
      err.statusCode = 400;
      throw err;
    }

    // Validate capacity
    if (!capacity || typeof capacity.value !== 'number' || capacity.value <= 0) {
      const err: any = new Error('Capacity value must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    const allowedUnits = ['kg', 'g', 'mg', 't', 'l', 'ml', 'm', 'mm'];
    if (!capacity.unit || !allowedUnits.includes(capacity.unit.trim().toLowerCase())) {
      const err: any = new Error(`Capacity unit must be one of: ${allowedUnits.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    // Validate location
    if (
      !location ||
      !location.address || !location.address.trim() ||
      !location.city || !location.city.trim() ||
      !location.district || !location.district.trim() ||
      !location.state || !location.state.trim()
    ) {
      const err: any = new Error('Complete location (address, city, district, state, pincode, coordinates) is required');
      err.statusCode = 400;
      throw err;
    }

    if (!/^\d{6}$/.test(String(location.pincode).trim())) {
      const err: any = new Error('Pincode must be a 6-digit numeric string');
      err.statusCode = 400;
      throw err;
    }

    if (
      !location.coordinates ||
      !Array.isArray(location.coordinates.coordinates) ||
      location.coordinates.coordinates.length !== 2
    ) {
      const err: any = new Error('Valid coordinates [longitude, latitude] are required');
      err.statusCode = 400;
      throw err;
    }

    const [lon, lat] = location.coordinates.coordinates;
    if (typeof lon !== 'number' || lon < -180 || lon > 180 || typeof lat !== 'number' || lat < -90 || lat > 90) {
      const err: any = new Error('Coordinates must be valid: longitude between -180 and 180, latitude between -90 and 90');
      err.statusCode = 400;
      throw err;
    }

    // Check for duplicate manufacturer + serialNumber (case-insensitive)
    const normalizedManufacturer = manufacturer.trim();
    const normalizedSerial = serialNumber.trim();

    const existingDuplicate = await Instrument.findOne({
      manufacturer: normalizedManufacturer,
      serialNumber: normalizedSerial
    }).collation({ locale: 'en', strength: 2 });

    if (existingDuplicate) {
      const err: any = new Error('An instrument with this manufacturer and serial number already exists');
      err.statusCode = 409;
      throw err;
    }

    // Generate atomic system instrumentId (e.g., WM-MDU-00102)
    const instrumentId = await generateInstrumentId(location.city, location.district, location.state);

    // Build initial lifecycle history event
    const registrationEvent: ILifecycleEvent = {
      eventType: 'REGISTRATION',
      timestamp: new Date(),
      performedBy: caller._id as mongoose.Types.ObjectId,
      description: `Instrument registered by ${caller.role}: ${caller.name}`,
      metadata: { initialStatus: 'REGISTERED' }
    };

    const instrument = new Instrument({
      instrumentId,
      owner: targetOwnerId,
      type: type.trim(),
      category: category.trim(),
      manufacturer: normalizedManufacturer,
      model: model.trim(),
      serialNumber: normalizedSerial,
      capacity: {
        value: capacity.value,
        unit: capacity.unit.trim().toLowerCase()
      },
      accuracyClass: data.accuracyClass ? data.accuracyClass.trim() : undefined,
      location: {
        address: location.address.trim(),
        city: location.city.trim(),
        district: location.district.trim(),
        state: location.state.trim(),
        pincode: String(location.pincode).trim(),
        coordinates: {
          type: 'Point',
          coordinates: [lon, lat]
        }
      },
      status: 'REGISTERED',
      lifecycleHistory: [registrationEvent],
      isArchived: false,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await instrument.save();
    return instrument;
  }

  /**
   * Retrieves paginated list of instruments with safe filters and role-based scoping
   */
  async listInstruments(
    query: ListInstrumentsQuery,
    caller: IUser
  ): Promise<{ data: IInstrument[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Role-based visibility
    if (caller.role === 'OWNER') {
      filter.owner = caller._id;
    }

    // Archival filter: exclude archived by default unless ADMIN explicitly requests includeArchived
    if (caller.role === 'ADMIN' && query.includeArchived === true) {
      // include all
    } else {
      filter.isArchived = false;
    }

    // Safe string filters to prevent operator injection
    if (query.status && typeof query.status === 'string') {
      const allowedStatuses = [
        'REGISTERED',
        'ACTIVE',
        'INACTIVE',
        'UNDER_VERIFICATION',
        'SUSPENDED',
        'DECOMMISSIONED'
      ];
      if (allowedStatuses.includes(query.status.toUpperCase())) {
        filter.status = query.status.toUpperCase();
      }
    }

    if (query.city && typeof query.city === 'string') {
      const sanitizedCity = query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['location.city'] = new RegExp(`^${sanitizedCity}$`, 'i');
    }

    if (query.type && typeof query.type === 'string') {
      const sanitizedType = query.type.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.type = new RegExp(`^${sanitizedType}$`, 'i');
    }

    if (query.category && typeof query.category === 'string') {
      const sanitizedCat = query.category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.category = new RegExp(`^${sanitizedCat}$`, 'i');
    }

    const [data, total] = await Promise.all([
      Instrument.find(filter)
        .populate('owner', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Instrument.countDocuments(filter)
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Retrieves single instrument details by instrumentId with role access verification
   */
  async getInstrumentById(instrumentId: string, caller: IUser): Promise<IInstrument> {
    const instrument = await Instrument.findOne({ instrumentId }).populate('owner', 'name email role');

    if (!instrument) {
      const err: any = new Error('Instrument not found');
      err.statusCode = 404;
      throw err;
    }

    // Access check: OWNER can only view their own instruments
    if (caller.role === 'OWNER' && instrument.owner._id.toString() !== caller._id.toString()) {
      const err: any = new Error('Instrument not found');
      err.statusCode = 404;
      throw err;
    }

    return instrument;
  }

  /**
   * Updates permitted editable fields of an instrument
   */
  async updateInstrument(
    instrumentId: string,
    updates: UpdateInstrumentDTO,
    caller: IUser
  ): Promise<IInstrument> {
    if (caller.role === 'INSPECTOR') {
      const err: any = new Error('Inspectors have read-only access to instruments in Phase 3');
      err.statusCode = 403;
      throw err;
    }

    const instrument = await Instrument.findOne({ instrumentId });
    if (!instrument) {
      const err: any = new Error('Instrument not found');
      err.statusCode = 404;
      throw err;
    }

    if (caller.role === 'OWNER' && instrument.owner.toString() !== caller._id.toString()) {
      const err: any = new Error('Instrument not found');
      err.statusCode = 404;
      throw err;
    }

    if (instrument.isArchived) {
      const err: any = new Error('Archived instruments cannot be modified');
      err.statusCode = 400;
      throw err;
    }

    const changedFields: string[] = [];

    // Safe updates for OWNER and ADMIN
    if (updates.model && typeof updates.model === 'string' && updates.model.trim()) {
      const newModel = updates.model.trim();
      if ((instrument as any).model !== newModel) {
        (instrument as any).model = newModel;
        changedFields.push('model');
      }
    }

    if (updates.accuracyClass !== undefined) {
      const newAccuracy = updates.accuracyClass.trim();
      if (instrument.accuracyClass !== newAccuracy) {
        instrument.accuracyClass = newAccuracy;
        changedFields.push('accuracyClass');
      }
    }

    if (updates.capacity) {
      if (typeof updates.capacity.value === 'number' && updates.capacity.value > 0) {
        if (instrument.capacity.value !== updates.capacity.value) {
          instrument.capacity.value = updates.capacity.value;
          changedFields.push('capacity.value');
        }
      }
      if (updates.capacity.unit) {
        const allowedUnits = ['kg', 'g', 'mg', 't', 'l', 'ml', 'm', 'mm'];
        const unit = updates.capacity.unit.trim().toLowerCase();
        if (allowedUnits.includes(unit) && instrument.capacity.unit !== unit) {
          instrument.capacity.unit = unit;
          changedFields.push('capacity.unit');
        }
      }
    }

    if (updates.location) {
      if (updates.location.address && updates.location.address.trim()) {
        const newAddress = updates.location.address.trim();
        if (instrument.location.address !== newAddress) {
          instrument.location.address = newAddress;
          changedFields.push('location.address');
        }
      }
      if (updates.location.city && updates.location.city.trim()) {
        const newCity = updates.location.city.trim();
        if (instrument.location.city !== newCity) {
          instrument.location.city = newCity;
          changedFields.push('location.city');
        }
      }
      if (updates.location.district && updates.location.district.trim()) {
        const newDistrict = updates.location.district.trim();
        if (instrument.location.district !== newDistrict) {
          instrument.location.district = newDistrict;
          changedFields.push('location.district');
        }
      }
      if (updates.location.state && updates.location.state.trim()) {
        const newState = updates.location.state.trim();
        if (instrument.location.state !== newState) {
          instrument.location.state = newState;
          changedFields.push('location.state');
        }
      }
      if (updates.location.pincode && /^\d{6}$/.test(String(updates.location.pincode).trim())) {
        const newPincode = String(updates.location.pincode).trim();
        if (instrument.location.pincode !== newPincode) {
          instrument.location.pincode = newPincode;
          changedFields.push('location.pincode');
        }
      }
      if (
        updates.location.coordinates &&
        Array.isArray(updates.location.coordinates.coordinates) &&
        updates.location.coordinates.coordinates.length === 2
      ) {
        const [lon, lat] = updates.location.coordinates.coordinates;
        if (typeof lon === 'number' && lon >= -180 && lon <= 180 && typeof lat === 'number' && lat >= -90 && lat <= 90) {
          const currentCoords = instrument.location.coordinates?.coordinates;
          if (!currentCoords || currentCoords[0] !== lon || currentCoords[1] !== lat) {
            instrument.location.coordinates = {
              type: 'Point',
              coordinates: [lon, lat]
            };
            changedFields.push('location.coordinates');
          }
        }
      }
    }

    // ADMIN-only updates
    if (caller.role === 'ADMIN') {
      if (updates.type && typeof updates.type === 'string' && updates.type.trim()) {
        const newType = updates.type.trim();
        if (instrument.type !== newType) {
          instrument.type = newType;
          changedFields.push('type');
        }
      }
      if (updates.category && typeof updates.category === 'string' && updates.category.trim()) {
        const newCategory = updates.category.trim();
        if (instrument.category !== newCategory) {
          instrument.category = newCategory;
          changedFields.push('category');
        }
      }
      if (updates.status) {
        const allowedStatuses: InstrumentStatus[] = [
          'REGISTERED',
          'ACTIVE',
          'INACTIVE',
          'UNDER_VERIFICATION',
          'SUSPENDED',
          'DECOMMISSIONED'
        ];
        if (allowedStatuses.includes(updates.status) && instrument.status !== updates.status) {
          instrument.status = updates.status;
          changedFields.push('status');
        }
      }
    }

    if (changedFields.length === 0) {
      return instrument;
    }

    instrument.updatedBy = caller._id as mongoose.Types.ObjectId;

    // Append append-only lifecycle event
    instrument.lifecycleHistory.push({
      eventType: changedFields.includes('status') ? 'STATUS_CHANGE' : 'DETAIL_UPDATE',
      timestamp: new Date(),
      performedBy: caller._id as mongoose.Types.ObjectId,
      description: `Instrument updated by ${caller.role}: ${caller.name}`,
      metadata: { changedFields }
    });

    await instrument.save();
    return instrument;
  }

  /**
   * Soft archival of an instrument (ADMIN only)
   */
  async archiveInstrument(instrumentId: string, caller: IUser): Promise<IInstrument> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can archive instruments');
      err.statusCode = 403;
      throw err;
    }

    const instrument = await Instrument.findOne({ instrumentId });
    if (!instrument) {
      const err: any = new Error('Instrument not found');
      err.statusCode = 404;
      throw err;
    }

    if (instrument.isArchived) {
      const err: any = new Error('Instrument is already archived');
      err.statusCode = 400;
      throw err;
    }

    instrument.isArchived = true;
    instrument.archivedAt = new Date();
    instrument.updatedBy = caller._id as mongoose.Types.ObjectId;

    // Append archival event
    instrument.lifecycleHistory.push({
      eventType: 'ARCHIVED',
      timestamp: new Date(),
      performedBy: caller._id as mongoose.Types.ObjectId,
      description: `Instrument soft-archived by ADMIN: ${caller.name}`,
      metadata: { previousStatus: instrument.status }
    });

    await instrument.save();
    return instrument;
  }

  /**
   * Formats Digital Instrument Passport response without fabrication
   */
  async getPassport(instrumentId: string, caller: IUser): Promise<any> {
    const instrument = await this.getInstrumentById(instrumentId, caller);

    return {
      passportVersion: '1.0',
      identity: {
        instrumentId: instrument.instrumentId,
        type: instrument.type,
        category: instrument.category,
        manufacturer: instrument.manufacturer,
        model: instrument.model,
        serialNumber: instrument.serialNumber
      },
      specifications: {
        capacity: instrument.capacity,
        accuracyClass: instrument.accuracyClass || null
      },
      owner: {
        id: (instrument.owner as any)._id || instrument.owner,
        name: (instrument.owner as any).name || 'N/A',
        email: (instrument.owner as any).email || 'N/A'
      },
      location: instrument.location,
      status: instrument.status,
      currentCertificate: instrument.currentCertificate || null,
      lifecycleTimeline: instrument.lifecycleHistory.map((e) => ({
        eventType: e.eventType,
        timestamp: e.timestamp,
        description: e.description
      })),
      metadata: {
        isArchived: instrument.isArchived,
        archivedAt: instrument.archivedAt || null,
        createdAt: instrument.createdAt,
        updatedAt: instrument.updatedAt
      }
    };
  }
}

export const instrumentService = new InstrumentService();
