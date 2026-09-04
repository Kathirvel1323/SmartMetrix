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

    // 1. Instruments
    if (entityTypes.includes('instruments')) {
      const filter: any = {};
      if (user.role === 'OWNER') {
        filter.$or = [{ owner: userId }, { ownerId: String(userId) }];
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
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, textFilter];
          delete filter.$or;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.instruments = await Instrument.find(filter).skip(skip).limit(limit).lean();
    }

    // 2. Verifications
    if (entityTypes.includes('verifications')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.$or = [{ owner: userId }, { ownerId: String(userId) }];
      if (user.role === 'INSPECTOR') filter.$or = [{ inspector: userId }, { inspectorId: String(userId) }, { assignedInspector: userId }, { assignedInspectorId: String(userId) }];
      if (query.city) filter['location.city'] = query.city;
      if (query.status) filter.status = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { requestId: regex },
            { instrumentId: regex },
            { verificationType: regex }
          ]
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, textFilter];
          delete filter.$or;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.verifications = await VerificationRequest.find(filter).skip(skip).limit(limit).lean();
    }

    // 3. Inspections
    if (entityTypes.includes('inspections')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.$or = [{ owner: userId }, { ownerId: String(userId) }];
      if (user.role === 'INSPECTOR') filter.$or = [{ inspector: userId }, { inspectorId: String(userId) }];
      if (query.status) filter.overallResult = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { inspectionId: regex },
            { requestId: regex },
            { instrumentId: regex }
          ]
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, textFilter];
          delete filter.$or;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.inspections = await Inspection.find(filter).skip(skip).limit(limit).lean();
    }

    // 4. Certificates
    if (entityTypes.includes('certificates')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.$or = [{ owner: userId }, { ownerId: String(userId) }];
      if (query.status) filter.status = query.status;

      if (regex) {
        const textFilter = {
          $or: [
            { certificateId: regex },
            { instrumentId: regex },
            { publicVerificationId: regex }
          ]
        };
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, textFilter];
          delete filter.$or;
        } else {
          filter.$or = textFilter.$or;
        }
      }
      results.certificates = await Certificate.find(filter).skip(skip).limit(limit).lean();
    }

    // 5. Complaints
    if (entityTypes.includes('complaints') && user.role !== 'OWNER') {
      const filter: any = {};
      if (user.role === 'INSPECTOR') filter.assignedInspectorId = String(userId);
      if (query.status) filter.status = query.status;
      if (regex) {
        filter.$or = [
          { complaintId: regex },
          { instrumentId: regex },
          { city: regex },
          { category: regex }
        ];
      }
      results.complaints = await Complaint.find(filter).skip(skip).limit(limit).lean();
    }

    // 6. Improvement Notices
    if (entityTypes.includes('improvement-notices')) {
      const filter: any = {};
      if (user.role === 'OWNER') filter.issuedToOwnerId = String(userId);
      if (user.role === 'INSPECTOR') filter.issuedByInspectorId = String(userId);
      if (query.status) filter.status = query.status;
      if (regex) {
        filter.$or = [
          { noticeId: regex },
          { instrumentId: regex }
        ];
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
