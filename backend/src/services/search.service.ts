import { Instrument } from '../models/instrument.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Inspection } from '../models/inspection.model';
import { Certificate } from '../models/certificate.model';
import { Complaint } from '../models/complaint.model';
import { ImprovementNotice } from '../models/improvement-notice.model';

export class SearchService {
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async search(
    user: { id: string; role: string; _id?: any },
    query: {
      query?: string;
      entityType?: string;
      status?: string;
      city?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const term = query.query ? this.escapeRegExp(query.query.trim()) : '';
    const regex = term ? new RegExp(term, 'i') : null;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const results: Record<string, any[]> = {};
    const entityTypes = query.entityType && query.entityType !== 'all'
      ? [query.entityType]
      : ['instruments', 'verifications', 'inspections', 'certificates', 'complaints', 'improvement-notices'];

    const userId = user.id || user._id;
    const ownedInstrumentIds = user.role === 'OWNER'
      ? await Instrument.find({ owner: userId }).distinct('_id')
      : [];

    // 1. Instruments
    if (entityTypes.includes('instruments')) {
      const filter: any = {};
      if (user.role === 'OWNER') {
        filter.owner = userId;
      }
      if (query.city) filter['location.city'] = query.city;
      if (query.status) filter.status = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { instrumentId: regex },
            { serialNumber: regex },
            { model: regex },
            { manufacturer: regex },
            { category: regex }
          ]
        };
        if (filter.owner) {
          filter.$and = [{ owner: filter.owner }, textFilter];
          delete filter.owner;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.instruments = await Instrument.find(filter).skip(skip).limit(limit).lean();
    }

    // 2. Verifications
    if (entityTypes.includes('verifications')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.owner = userId;
      if (user.role === 'INSPECTOR') filter.assignedInspector = userId;
      if (query.status) filter.status = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { requestId: regex },
            { verificationType: regex }
          ]
        };
        const scopeEntries = Object.entries(filter);
        if (scopeEntries.length > 0) {
          filter.$and = [Object.fromEntries(scopeEntries), textFilter];
          for (const key of Object.keys(filter)) if (key !== '$and') delete filter[key];
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.verifications = await VerificationRequest.find(filter).skip(skip).limit(limit).lean();
    }

    // 3. Inspections
    if (entityTypes.includes('inspections')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.instrument = { $in: ownedInstrumentIds };
      if (user.role === 'INSPECTOR') filter.inspector = userId;
      if (query.status) filter.inspectorResult = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { inspectionId: regex },
            { remarks: regex },
            { potentialTamperingIndicators: regex }
          ]
        };
        const scopeEntries = Object.entries(filter);
        if (scopeEntries.length > 0) {
          filter.$and = [Object.fromEntries(scopeEntries), textFilter];
          for (const key of Object.keys(filter)) if (key !== '$and') delete filter[key];
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.inspections = await Inspection.find(filter).skip(skip).limit(limit).lean();
    }

    // 4. Certificates
    if (entityTypes.includes('certificates')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.owner = userId;
      if (query.status) filter.status = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { certificateNumber: regex },
            { publicVerificationId: regex },
            { 'instrumentSnapshot.instrumentId': regex },
            { 'instrumentSnapshot.manufacturer': regex },
            { 'instrumentSnapshot.model': regex }
          ]
        };
        if (filter.owner) {
          filter.$and = [{ owner: filter.owner }, textFilter];
          delete filter.owner;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.certificates = await Certificate.find(filter).skip(skip).limit(limit).lean();
    }

    // 5. Complaints
    if (entityTypes.includes('complaints')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.instrument = { $in: ownedInstrumentIds };
      if (user.role === 'INSPECTOR') filter.assignedTo = userId;
      if (query.status) filter.status = query.status;
      if (regex) {
        filter.$or = [
          { complaintId: regex },
          { publicVerificationId: regex },
          { category: regex },
          { description: regex }
        ];
        const scopeEntries = Object.entries(filter).filter(([key]) => key !== '$or');
        if (scopeEntries.length > 0) {
          const textFilter = { $or: filter.$or };
          filter.$and = [Object.fromEntries(scopeEntries), textFilter];
          for (const key of Object.keys(filter)) if (key !== '$and') delete filter[key];
        }
      }
      results.complaints = await Complaint.find(filter).skip(skip).limit(limit).lean();
    }

    // 6. Improvement Notices
    if (entityTypes.includes('improvement-notices')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.instrument = { $in: ownedInstrumentIds };
      if (user.role === 'INSPECTOR') filter.issuedBy = userId;
      if (query.status) filter.status = query.status;
      if (regex) {
        filter.$or = [
          { noticeId: regex },
          { reason: regex },
          { requiredCorrection: regex }
        ];
        const scopeEntries = Object.entries(filter).filter(([key]) => key !== '$or');
        if (scopeEntries.length > 0) {
          const textFilter = { $or: filter.$or };
          filter.$and = [Object.fromEntries(scopeEntries), textFilter];
          for (const key of Object.keys(filter)) if (key !== '$and') delete filter[key];
        }
      }
      results.improvementNotices = await ImprovementNotice.find(filter).skip(skip).limit(limit).lean();
    }

    return {
      query: query.query || '',
      results,
      pagination: { page, limit }
    };
  }
}

export const searchService = new SearchService();
