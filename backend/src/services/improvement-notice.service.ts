import mongoose from 'mongoose';
import { ImprovementNotice, IImprovementNotice, NoticeStatus } from '../models/improvement-notice.model';
import { Inspection } from '../models/inspection.model';
import { Instrument } from '../models/instrument.model';
import { IUser } from '../models/user.model';
import { generateNoticeId } from '../utils/phase8-id.utils';

export interface IssueNoticeDTO {
  inspectionId: string;
  reason: string;
  deadline: string; // ISO date string
  requiredCorrection: string;
}

export class ImprovementNoticeService {
  async issueNotice(dto: IssueNoticeDTO, caller: IUser): Promise<IImprovementNotice> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or assigned INSPECTOR can issue improvement notices'), { statusCode: 403 });
    }

    const inspection = await Inspection.findOne({ inspectionId: dto.inspectionId.trim().toUpperCase(), status: 'FINALIZED' });
    if (!inspection) {
      throw Object.assign(new Error('Finalized inspection not found'), { statusCode: 404 });
    }

    const inst = await Instrument.findById(inspection.instrument);
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const deadlineDate = new Date(dto.deadline);
    const now = new Date();
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
      throw Object.assign(new Error('Deadline must be a valid future date'), { statusCode: 400 });
    }

    if (!dto.reason || dto.reason.trim().length < 5) {
      throw Object.assign(new Error('Reason is required (min 5 characters)'), { statusCode: 400 });
    }

    if (!dto.requiredCorrection || dto.requiredCorrection.trim().length < 5) {
      throw Object.assign(new Error('Required correction is required (min 5 characters)'), { statusCode: 400 });
    }

    const noticeId = await generateNoticeId();
    const notice = new ImprovementNotice({
      noticeId,
      instrument: inst._id,
      inspection: inspection._id,
      issuedBy: caller._id,
      reason: dto.reason.trim(),
      issueDate: now,
      deadline: deadlineDate,
      requiredCorrection: dto.requiredCorrection.trim(),
      status: 'OPEN',
      statusHistory: [
        {
          status: 'OPEN',
          timestamp: now,
          changedBy: caller._id as any,
          remarks: 'Improvement Notice issued'
        }
      ]
    });

    await notice.save();

    // Add event to instrument lifecycle history
    inst.lifecycleHistory.push({
      eventType: 'IMPROVEMENT_NOTICE_ISSUED',
      timestamp: now,
      performedBy: caller._id as any,
      description: `Improvement Notice ${noticeId} issued. Deadline: ${deadlineDate.toISOString().split('T')[0]}.`
    });
    await inst.save();

    return notice;
  }

  async listNotices(caller: IUser) {
    if (caller.role === 'OWNER') {
      const ownedInstruments = await Instrument.find({ owner: caller._id }).select('_id');
      const ownedInstIds = ownedInstruments.map((i) => i._id);
      return ImprovementNotice.find({ instrument: { $in: ownedInstIds } }).sort({ createdAt: -1 });
    }

    if (caller.role === 'INSPECTOR') {
      return ImprovementNotice.find({ issuedBy: caller._id }).sort({ createdAt: -1 });
    }

    return ImprovementNotice.find({}).sort({ createdAt: -1 });
  }

  async getNoticeById(noticeId: string, caller: IUser) {
    const notice = await ImprovementNotice.findOne({ noticeId: noticeId.trim().toUpperCase() })
      .populate('instrument')
      .populate('issuedBy', 'name role -_id');

    if (!notice) {
      throw Object.assign(new Error('Improvement Notice not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER') {
      const inst = await Instrument.findById(notice.instrument);
      if (!inst || inst.owner.toString() !== (caller._id as any).toString()) {
        throw Object.assign(new Error('Improvement Notice not found'), { statusCode: 404 });
      }
    }

    return notice;
  }

  async updateNoticeStatus(
    noticeId: string,
    newStatus: NoticeStatus,
    remarks: string | undefined,
    closureRemarks: string | undefined,
    caller: IUser
  ) {
    const notice = await ImprovementNotice.findOne({ noticeId: noticeId.trim().toUpperCase() });
    if (!notice) {
      throw Object.assign(new Error('Improvement Notice not found'), { statusCode: 404 });
    }

    const inst = await Instrument.findById(notice.instrument);
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    // Role ownership check
    if (caller.role === 'OWNER') {
      if (inst.owner.toString() !== (caller._id as any).toString()) {
        throw Object.assign(new Error('Improvement Notice not found'), { statusCode: 404 });
      }
      // OWNER can only advance to CORRECTION_IN_PROGRESS or REINSPECTION_PENDING
      if (!['CORRECTION_IN_PROGRESS', 'REINSPECTION_PENDING'].includes(newStatus)) {
        throw Object.assign(
          new Error('OWNER can only update status to CORRECTION_IN_PROGRESS or REINSPECTION_PENDING'),
          { statusCode: 403 }
        );
      }
    }

    // Closing requires INSPECTOR or ADMIN
    if (newStatus === 'CLOSED') {
      if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
        throw Object.assign(new Error('Only ADMIN or INSPECTOR can close an improvement notice'), { statusCode: 403 });
      }
      if (!closureRemarks || closureRemarks.trim().length < 5) {
        throw Object.assign(new Error('Closure remarks (min 5 characters) are mandatory when closing a notice'), { statusCode: 400 });
      }
      notice.closureRemarks = closureRemarks.trim();
    }

    const allowedTransitions: Record<NoticeStatus, NoticeStatus[]> = {
      OPEN: ['CORRECTION_IN_PROGRESS', 'ESCALATED'],
      CORRECTION_IN_PROGRESS: ['REINSPECTION_PENDING', 'ESCALATED'],
      REINSPECTION_PENDING: ['CLOSED', 'ESCALATED'],
      CLOSED: [],
      ESCALATED: ['CLOSED']
    };

    if (!allowedTransitions[notice.status].includes(newStatus)) {
      throw Object.assign(
        new Error(`Invalid status transition from ${notice.status} to ${newStatus}`),
        { statusCode: 409 }
      );
    }

    const now = new Date();
    notice.status = newStatus;
    notice.statusHistory.push({
      status: newStatus,
      timestamp: now,
      changedBy: caller._id as any,
      remarks: remarks ? remarks.trim() : `Status updated to ${newStatus}`
    });

    await notice.save();

    return notice;
  }
}

export const improvementNoticeService = new ImprovementNoticeService();
