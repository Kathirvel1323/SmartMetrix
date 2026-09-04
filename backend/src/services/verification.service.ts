import mongoose from 'mongoose';
import {
  VerificationRequest,
  IVerificationRequest,
  VerificationStatus,
  VerificationType
} from '../models/verification-request.model';
import { Instrument } from '../models/instrument.model';
import { User, IUser } from '../models/user.model';
import { generateVerificationRequestId } from '../utils/verification-id.utils';

export interface CreateVerificationRequestDTO {
  instrumentId: string;
  verificationType: VerificationType;
  remarks?: string;
}

export interface ListVerificationsQuery {
  page?: number;
  limit?: number;
  status?: string;
  verificationType?: string;
  startDate?: string;
  endDate?: string;
  inspectorId?: string;
  ownerId?: string;
}

export interface ReviewVerificationDTO {
  reviewRemarks?: string;
}

export interface AssignInspectorDTO {
  inspectorId: string;
  remarks?: string;
}

export interface ScheduleVerificationDTO {
  scheduledAt: string | Date;
  estimatedDurationMinutes: number;
  scheduleLocation?: string;
  scheduleNotes?: string;
}

export class VerificationService {
  /**
   * Submits a new verification request (OWNER only)
   */
  async createVerificationRequest(
    data: CreateVerificationRequestDTO,
    caller: IUser
  ): Promise<IVerificationRequest> {
    if (caller.role !== 'OWNER') {
      const err: any = new Error('Only instrument owners can submit verification requests');
      err.statusCode = 403;
      throw err;
    }

    const { instrumentId, verificationType, remarks } = data;

    if (!instrumentId || !instrumentId.trim()) {
      const err: any = new Error('instrumentId is required');
      err.statusCode = 400;
      throw err;
    }

    const validTypes: VerificationType[] = ['INITIAL', 'RE_VERIFICATION'];
    if (!verificationType || !validTypes.includes(verificationType)) {
      const err: any = new Error('verificationType must be either INITIAL or RE_VERIFICATION');
      err.statusCode = 400;
      throw err;
    }

    // Find the instrument by ObjectId or instrumentId
    let instrumentQuery: Record<string, any>;
    if (mongoose.Types.ObjectId.isValid(instrumentId.trim())) {
      instrumentQuery = { _id: new mongoose.Types.ObjectId(instrumentId.trim()) };
    } else {
      instrumentQuery = { instrumentId: instrumentId.trim().toUpperCase() };
    }

    const instrument = await Instrument.findOne(instrumentQuery);
    if (!instrument) {
      const err: any = new Error('Referenced instrument not found');
      err.statusCode = 404;
      throw err;
    }

    // Ownership check: Foreign instrument rejection
    if (instrument.owner.toString() !== caller._id.toString()) {
      const err: any = new Error('Access forbidden: You do not own this instrument');
      err.statusCode = 403;
      throw err;
    }

    // Archived instrument rejection
    if (instrument.isArchived) {
      const err: any = new Error('Archived instruments cannot be submitted for verification');
      err.statusCode = 400;
      throw err;
    }

    // Prevent duplicate active verification requests for the same instrument
    const activeStatuses: VerificationStatus[] = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'ASSIGNED',
      'SCHEDULED',
      'INSPECTION_COMPLETED',
      'PASSED',
      'CERTIFICATE_ISSUED'
    ];
    const existingActiveRequest = await VerificationRequest.findOne({
      instrument: instrument._id,
      status: { $in: activeStatuses }
    });

    if (existingActiveRequest) {
      const err: any = new Error(
        `An active verification request already exists for this instrument (${existingActiveRequest.requestId}) in status: ${existingActiveRequest.status}`
      );
      err.statusCode = 409;
      throw err;
    }

    // Atomically generate unique Request ID (VRF-YYYY-00001)
    const requestId = await generateVerificationRequestId();

    const initialHistoryEvent = {
      status: 'SUBMITTED' as VerificationStatus,
      timestamp: new Date(),
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks: remarks?.trim() || 'Verification request submitted by owner'
    };

    const verification = new VerificationRequest({
      requestId,
      instrument: instrument._id,
      owner: caller._id,
      verificationType,
      remarks: remarks?.trim(),
      status: 'SUBMITTED',
      submittedAt: new Date(),
      statusHistory: [initialHistoryEvent],
      createdBy: caller._id,
      updatedBy: caller._id
    });

    try {
      await verification.save();
      return verification;
    } catch (err: any) {
      // MongoDB duplicate-key race error caught by the unique partial index
      if (err.code === 11000) {
        const conflictErr: any = new Error(
          'An active verification request already exists for this instrument'
        );
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Retrieves paginated list of verification requests with strict role-based scoping
   */
  async listVerificationRequests(
    query: ListVerificationsQuery,
    caller: IUser
  ): Promise<{
    data: IVerificationRequest[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Role-based scoping
    if (caller.role === 'OWNER') {
      filter.owner = caller._id;
    } else if (caller.role === 'INSPECTOR') {
      filter.assignedInspector = caller._id;
    } else if (caller.role === 'ADMIN') {
      if (query.ownerId && mongoose.Types.ObjectId.isValid(query.ownerId)) {
        filter.owner = new mongoose.Types.ObjectId(query.ownerId);
      }
      if (query.inspectorId && mongoose.Types.ObjectId.isValid(query.inspectorId)) {
        filter.assignedInspector = new mongoose.Types.ObjectId(query.inspectorId);
      }
    }

    // Safe allow-listed filters
    if (query.status && typeof query.status === 'string') {
      const allowedStatuses: VerificationStatus[] = [
        'SUBMITTED',
        'UNDER_REVIEW',
        'ASSIGNED',
        'SCHEDULED',
        'INSPECTION_COMPLETED',
        'PASSED',
        'FAILED',
        'CERTIFICATE_ISSUED',
        'CLOSED'
      ];
      const targetStatus = query.status.trim().toUpperCase() as VerificationStatus;
      if (allowedStatuses.includes(targetStatus)) {
        filter.status = targetStatus;
      }
    }

    if (query.verificationType && typeof query.verificationType === 'string') {
      const allowedTypes: VerificationType[] = ['INITIAL', 'RE_VERIFICATION'];
      const targetType = query.verificationType.trim().toUpperCase() as VerificationType;
      if (allowedTypes.includes(targetType)) {
        filter.verificationType = targetType;
      }
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      filter.submittedAt = {};
      if (query.startDate && !isNaN(new Date(query.startDate).getTime())) {
        filter.submittedAt.$gte = new Date(query.startDate);
      }
      if (query.endDate && !isNaN(new Date(query.endDate).getTime())) {
        filter.submittedAt.$lte = new Date(query.endDate);
      }
      if (Object.keys(filter.submittedAt).length === 0) {
        delete filter.submittedAt;
      }
    }

    const [data, total] = await Promise.all([
      VerificationRequest.find(filter)
        .populate('instrument', 'instrumentId type model location')
        .populate('owner', 'name email role')
        .populate('assignedInspector', 'name email role')
        .populate('reviewedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VerificationRequest.countDocuments(filter)
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
   * Retrieves single verification request by requestId with role-based access checks
   */
  async getVerificationRequestById(
    requestId: string,
    caller: IUser
  ): Promise<IVerificationRequest> {
    const formattedId = requestId.trim().toUpperCase();
    const verification = await VerificationRequest.findOne({ requestId: formattedId })
      .populate('instrument')
      .populate('owner', 'name email role')
      .populate('assignedInspector', 'name email role')
      .populate('reviewedBy', 'name email role');

    if (!verification) {
      const err: any = new Error('Verification request not found');
      err.statusCode = 404;
      throw err;
    }

    // Access control scoping:
    // OWNER can only view their own requests
    if (caller.role === 'OWNER') {
      const ownerId = (verification.owner as any)._id || verification.owner;
      if (ownerId.toString() !== caller._id.toString()) {
        const err: any = new Error('Verification request not found');
        err.statusCode = 404;
        throw err;
      }
    }

    // INSPECTOR can only view requests assigned to them
    if (caller.role === 'INSPECTOR') {
      const inspectorId =
        (verification.assignedInspector as any)?._id || verification.assignedInspector;
      if (!inspectorId || inspectorId.toString() !== caller._id.toString()) {
        const err: any = new Error('Verification request not found');
        err.statusCode = 404;
        throw err;
      }
    }

    return verification;
  }

  /**
   * Reviews a verification request: SUBMITTED → UNDER_REVIEW (ADMIN only)
   */
  async reviewVerificationRequest(
    requestId: string,
    data: ReviewVerificationDTO,
    caller: IUser
  ): Promise<IVerificationRequest> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can review verification requests');
      err.statusCode = 403;
      throw err;
    }

    const formattedId = requestId.trim().toUpperCase();
    const verification = await VerificationRequest.findOne({ requestId: formattedId });

    if (!verification) {
      const err: any = new Error('Verification request not found');
      err.statusCode = 404;
      throw err;
    }

    // State transition guard: strictly SUBMITTED → UNDER_REVIEW
    if (verification.status !== 'SUBMITTED') {
      const err: any = new Error(
        `Invalid state transition: only SUBMITTED requests can be reviewed (current status: ${verification.status})`
      );
      err.statusCode = 400;
      throw err;
    }

    const reviewRemarks = data.reviewRemarks?.trim();

    verification.status = 'UNDER_REVIEW';
    verification.reviewedBy = caller._id as mongoose.Types.ObjectId;
    verification.reviewedAt = new Date();
    if (reviewRemarks) {
      verification.reviewRemarks = reviewRemarks;
    }
    verification.updatedBy = caller._id as mongoose.Types.ObjectId;

    verification.statusHistory.push({
      status: 'UNDER_REVIEW',
      timestamp: new Date(),
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks: reviewRemarks || 'Verification request under review by admin'
    });

    await verification.save();
    return verification;
  }

  /**
   * Assigns an active inspector: UNDER_REVIEW → ASSIGNED (ADMIN only)
   */
  async assignInspector(
    requestId: string,
    data: AssignInspectorDTO,
    caller: IUser
  ): Promise<IVerificationRequest> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can assign inspectors');
      err.statusCode = 403;
      throw err;
    }

    const { inspectorId, remarks } = data;

    if (!inspectorId || !mongoose.Types.ObjectId.isValid(inspectorId)) {
      const err: any = new Error('A valid inspectorId is required');
      err.statusCode = 400;
      throw err;
    }

    const formattedId = requestId.trim().toUpperCase();
    const verification = await VerificationRequest.findOne({ requestId: formattedId });

    if (!verification) {
      const err: any = new Error('Verification request not found');
      err.statusCode = 404;
      throw err;
    }

    // State transition guard: UNDER_REVIEW → ASSIGNED (or re-assignment from ASSIGNED)
    if (!['UNDER_REVIEW', 'ASSIGNED'].includes(verification.status)) {
      const err: any = new Error(
        `Invalid state transition: only requests in UNDER_REVIEW or ASSIGNED status can be assigned (current status: ${verification.status})`
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate that the target user exists, is active, and has INSPECTOR role
    const inspector = await User.findById(inspectorId);
    if (!inspector || !inspector.isActive || inspector.role !== 'INSPECTOR') {
      const err: any = new Error(
        'Selected user not found, inactive, or does not have the INSPECTOR role'
      );
      err.statusCode = 400;
      throw err;
    }

    // Check no-op assignment (already assigned to the same inspector)
    if (
      verification.status === 'ASSIGNED' &&
      verification.assignedInspector?.toString() === inspector._id.toString()
    ) {
      return verification;
    }

    const previousInspector = verification.assignedInspector;
    const isReassignment = !!previousInspector && verification.status === 'ASSIGNED';

    verification.status = 'ASSIGNED';
    verification.assignedInspector = inspector._id as mongoose.Types.ObjectId;
    verification.assignedBy = caller._id as mongoose.Types.ObjectId;
    verification.assignedAt = new Date();
    verification.updatedBy = caller._id as mongoose.Types.ObjectId;

    verification.statusHistory.push({
      status: 'ASSIGNED',
      timestamp: new Date(),
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks:
        remarks?.trim() ||
        (isReassignment
          ? `Reassigned to inspector: ${inspector.name}`
          : `Assigned to inspector: ${inspector.name}`),
      metadata: {
        inspectorId: inspector._id,
        inspectorName: inspector.name,
        newInspector: inspector._id,
        ...(isReassignment ? { previousInspector } : {})
      }
    });

    await verification.save();
    return verification;
  }

  /**
   * Schedules a verification appointment: ASSIGNED → SCHEDULED (or rescheduling SCHEDULED → SCHEDULED)
   * Enforces future dates, duration bounds, and conflict prevention (ADMIN only)
   */
  async scheduleVerification(
    requestId: string,
    data: ScheduleVerificationDTO,
    caller: IUser
  ): Promise<IVerificationRequest> {
    if (caller.role !== 'ADMIN') {
      const err: any = new Error('Access forbidden: Only ADMIN can schedule verifications');
      err.statusCode = 403;
      throw err;
    }

    const formattedId = requestId.trim().toUpperCase();
    const verification = await VerificationRequest.findOne({ requestId: formattedId });

    if (!verification) {
      const err: any = new Error('Verification request not found');
      err.statusCode = 404;
      throw err;
    }

    // Require an assigned active inspector
    if (!verification.assignedInspector) {
      const err: any = new Error('Verification request must have an assigned inspector before scheduling');
      err.statusCode = 400;
      throw err;
    }

    const assignedInspector = await User.findById(verification.assignedInspector);
    if (!assignedInspector || !assignedInspector.isActive || assignedInspector.role !== 'INSPECTOR') {
      const err: any = new Error('Assigned inspector is inactive or no longer holds INSPECTOR role');
      err.statusCode = 400;
      throw err;
    }

    // State transition guard: only ASSIGNED → SCHEDULED, or SCHEDULED → SCHEDULED (rescheduling)
    if (!['ASSIGNED', 'SCHEDULED'].includes(verification.status)) {
      const err: any = new Error(
        `Invalid state transition: only ASSIGNED or SCHEDULED requests can be scheduled (current status: ${verification.status})`
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate scheduledAt date is in the future
    const schedDate = new Date(data.scheduledAt);
    if (isNaN(schedDate.getTime()) || schedDate.getTime() <= Date.now()) {
      const err: any = new Error('scheduledAt must be a valid future date and time');
      err.statusCode = 400;
      throw err;
    }

    // Validate integer, positive, bounded duration
    const rawDuration = data.estimatedDurationMinutes;
    const duration =
      typeof rawDuration === 'number'
        ? rawDuration
        : typeof rawDuration === 'string' &&
          (rawDuration as string).trim() !== '' &&
          !(rawDuration as string).includes('.')
        ? Number(rawDuration)
        : NaN;

    if (!Number.isInteger(duration) || duration < 15 || duration > 480) {
      const err: any = new Error(
        'estimatedDurationMinutes must be an integer between 15 and 480 minutes (8 hours)'
      );
      err.statusCode = 400;
      throw err;
    }

    // Conflict prevention: prevent overlapping schedules for the same inspector
    const proposedStart = schedDate.getTime();
    const proposedEnd = proposedStart + duration * 60 * 1000;

    const existingScheduled = await VerificationRequest.find({
      _id: { $ne: verification._id },
      assignedInspector: verification.assignedInspector,
      status: 'SCHEDULED',
      scheduledAt: { $exists: true }
    });

    for (const existing of existingScheduled) {
      if (!existing.scheduledAt) continue;
      const existStart = existing.scheduledAt.getTime();
      const existDuration = existing.estimatedDurationMinutes || 60;
      const existEnd = existStart + existDuration * 60 * 1000;

      // Overlap condition: proposedStart < existEnd && proposedEnd > existStart
      if (proposedStart < existEnd && proposedEnd > existStart) {
        const err: any = new Error(
          `Inspector has a conflicting schedule during this time window with request ${existing.requestId} (${existing.scheduledAt.toISOString()})`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    // No-op check for rescheduling with identical parameters
    const isSameDate = verification.scheduledAt?.getTime() === schedDate.getTime();
    const isSameDuration = verification.estimatedDurationMinutes === duration;
    const isSameLocation =
      (verification.scheduleLocation || '') === (data.scheduleLocation?.trim() || '');
    const isSameNotes =
      (verification.scheduleNotes || '') === (data.scheduleNotes?.trim() || '');

    if (
      verification.status === 'SCHEDULED' &&
      isSameDate &&
      isSameDuration &&
      isSameLocation &&
      isSameNotes
    ) {
      return verification;
    }

    const isReschedule = verification.status === 'SCHEDULED';

    verification.status = 'SCHEDULED';
    verification.scheduledAt = schedDate;
    verification.estimatedDurationMinutes = duration;
    if (data.scheduleLocation !== undefined) {
      verification.scheduleLocation = data.scheduleLocation.trim();
    }
    if (data.scheduleNotes !== undefined) {
      verification.scheduleNotes = data.scheduleNotes.trim();
    }
    verification.updatedBy = caller._id as mongoose.Types.ObjectId;

    verification.statusHistory.push({
      status: 'SCHEDULED',
      timestamp: new Date(),
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks:
        data.scheduleNotes?.trim() ||
        (isReschedule
          ? 'Verification appointment rescheduled by admin'
          : 'Verification appointment scheduled by admin'),
      metadata: {
        scheduledAt: schedDate,
        estimatedDurationMinutes: duration,
        isReschedule
      }
    });

    await verification.save();
    return verification;
  }
}

export const verificationService = new VerificationService();
