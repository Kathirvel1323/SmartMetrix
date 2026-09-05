import mongoose from 'mongoose';
import { Inspection, IInspection, IEvidenceFile } from '../models/inspection.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Instrument } from '../models/instrument.model';
import { User, IUser } from '../models/user.model';
import { generateInspectionId } from '../utils/inspection-id.utils';
import { findApplicableRule, calculateDeviation } from '../utils/tolerance.utils';
import { cleanupUploadedFiles } from '../middleware/upload.middleware';
import { v4 as uuidv4 } from 'uuid';

export interface SubmitInspectionDTO {
  verificationRequestId: string;
  inspectionDate?: string | Date;
  referenceReading: number;
  actualReading: number;
  inspectorResult: 'PASS' | 'FAIL';
  overrideReason?: string;
  serialNumberMatch: boolean;
  sealCondition?: string;
  displayCondition?: string;
  physicalDamage?: string;
  nameplateCondition?: string;
  potentialTamperingIndicators?: string;
  installationCondition?: string;
  remarks?: string;
  gpsLongitude?: number;
  gpsLatitude?: number;
  gpsAccuracy?: number;
  gpsCapturedAt?: string | Date;
}

export interface ListInspectionsQuery {
  page?: number;
  limit?: number;
  inspectorId?: string;
  instrumentId?: string;
  verificationRequestId?: string;
  inspectorResult?: 'PASS' | 'FAIL';
}

export class InspectionService {
  /**
   * INSPECTOR: Submit a field inspection for a SCHEDULED verification request.
   *
   * Implements an idempotent, compensating failure-safe workflow without requiring
   * multi-document transactions (compatible with standalone MongoDB instances):
   * a. Validate inspector assignment and SCHEDULED state.
   * b. Create inspection in a controlled PENDING state.
   * c. Atomically update verification request matching SCHEDULED state and assigned inspector.
   * d. Finalize inspection status to FINALIZED.
   * e. If any step fails, compensate by deleting the pending inspection and unlinking evidence.
   */
  async submitInspection(
    data: SubmitInspectionDTO,
    files: Express.Multer.File[],
    caller: IUser
  ): Promise<IInspection> {
    if (caller.role !== 'INSPECTOR') {
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error('Access forbidden: Only INSPECTOR can submit inspections'),
        { statusCode: 403 }
      );
    }

    const { verificationRequestId } = data;
    if (!verificationRequestId?.trim()) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('verificationRequestId is required'), { statusCode: 400 });
    }

    // Find the verification request — must be SCHEDULED
    const formattedVrfId = verificationRequestId.trim().toUpperCase();
    const vrf = await VerificationRequest.findOne({ requestId: formattedVrfId });
    if (!vrf) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('Verification request not found'), { statusCode: 404 });
    }

    if (vrf.status !== 'SCHEDULED') {
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error(`Inspection can only be submitted for SCHEDULED requests (current: ${vrf.status})`),
        { statusCode: 400 }
      );
    }

    // Inspector must be the active assigned inspector for this request
    if (!vrf.assignedInspector || vrf.assignedInspector.toString() !== caller._id.toString()) {
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error('You are not the assigned inspector for this verification request'),
        { statusCode: 403 }
      );
    }

    // Check one-inspection-per-request (pre-check for friendly message)
    const existingFinalized = await Inspection.findOne({
      verificationRequest: vrf._id,
      status: 'FINALIZED'
    });
    if (existingFinalized) {
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error(`An inspection (${existingFinalized.inspectionId}) already exists for this verification request`),
        { statusCode: 409 }
      );
    }

    // Clean up any stale unfinalized pending inspection from a prior failed attempt
    await Inspection.deleteMany({
      verificationRequest: vrf._id,
      status: { $in: ['PENDING', 'FAILED'] }
    });

    // Fetch the instrument
    const instrument = await Instrument.findById(vrf.instrument);
    if (!instrument) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    // Validate numeric readings
    if (
      data.referenceReading === undefined ||
      data.referenceReading === null ||
      (typeof data.referenceReading === 'string' && (data.referenceReading as string).trim() === '')
    ) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('referenceReading is required and must be a number'), { statusCode: 400 });
    }
    if (
      data.actualReading === undefined ||
      data.actualReading === null ||
      (typeof data.actualReading === 'string' && (data.actualReading as string).trim() === '')
    ) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('actualReading is required and must be a number'), { statusCode: 400 });
    }

    const referenceReading = Number(data.referenceReading);
    const actualReading = Number(data.actualReading);

    if (!isFinite(referenceReading)) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('referenceReading must be a finite number'), { statusCode: 400 });
    }
    if (!isFinite(actualReading)) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('actualReading must be a finite number'), { statusCode: 400 });
    }

    // Validate inspectorResult
    if (!['PASS', 'FAIL'].includes(data.inspectorResult)) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('inspectorResult must be PASS or FAIL'), { statusCode: 400 });
    }

    // Validate serialNumberMatch
    if (
      typeof data.serialNumberMatch !== 'boolean' &&
      data.serialNumberMatch !== ('true' as any) &&
      data.serialNumberMatch !== ('false' as any)
    ) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error('serialNumberMatch must be a boolean'), { statusCode: 400 });
    }
    const serialNumberMatch =
      typeof data.serialNumberMatch === 'boolean'
        ? data.serialNumberMatch
        : (data.serialNumberMatch as any) === 'true';

    // Find applicable tolerance rule using deterministic ordered tie-breakers
    const rule = await findApplicableRule(
      instrument.type,
      instrument.category,
      instrument.capacity.value,
      instrument.capacity.unit
    );
    if (!rule) {
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error(
          `No active tolerance rule found for instrument type '${instrument.type}', ` +
          `category '${instrument.category}', capacity ${instrument.capacity.value} ${instrument.capacity.unit}. ` +
          `Contact admin to configure applicable rules before submitting an inspection.`
        ),
        { statusCode: 422 }
      );
    }

    // Server-side calculation using decimal.js (unrounded comparison)
    const { deviation, deviationPercentage, calculatedAssessment, toleranceSnapshot } =
      calculateDeviation(referenceReading, actualReading, rule);

    // If inspector result differs from calculated assessment, overrideReason is mandatory
    const resultMatchesCalculation =
      (data.inspectorResult === 'PASS' && calculatedAssessment === 'WITHIN_TOLERANCE') ||
      (data.inspectorResult === 'FAIL' && calculatedAssessment === 'OUTSIDE_TOLERANCE');

    if (!resultMatchesCalculation) {
      if (!data.overrideReason?.trim()) {
        cleanupUploadedFiles(files);
        throw Object.assign(
          new Error(
            'overrideReason is required when inspector result differs from calculated assessment'
          ),
          { statusCode: 400 }
        );
      }
    }

    // Validate remarks lengths
    const MAX_REASON_LEN = 1000;
    const MAX_REMARKS_LEN = 2000;
    const MAX_FIELD_LEN = 500;

    if (data.overrideReason && data.overrideReason.trim().length > MAX_REASON_LEN) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error(`overrideReason must not exceed ${MAX_REASON_LEN} characters`), { statusCode: 400 });
    }
    if (data.remarks && data.remarks.trim().length > MAX_REMARKS_LEN) {
      cleanupUploadedFiles(files);
      throw Object.assign(new Error(`remarks must not exceed ${MAX_REMARKS_LEN} characters`), { statusCode: 400 });
    }
    for (const field of ['sealCondition', 'displayCondition', 'physicalDamage', 'nameplateCondition', 'installationCondition'] as const) {
      if (data[field] && data[field]!.trim().length > MAX_FIELD_LEN) {
        cleanupUploadedFiles(files);
        throw Object.assign(new Error(`${field} must not exceed ${MAX_FIELD_LEN} characters`), { statusCode: 400 });
      }
    }

    // GPS validation
    let gps: any = undefined;
    if (data.gpsLongitude !== undefined || data.gpsLatitude !== undefined) {
      const lon = Number(data.gpsLongitude);
      const lat = Number(data.gpsLatitude);
      if (!isFinite(lon) || lon < -180 || lon > 180) {
        cleanupUploadedFiles(files);
        throw Object.assign(new Error('gpsLongitude must be between -180 and 180'), { statusCode: 400 });
      }
      if (!isFinite(lat) || lat < -90 || lat > 90) {
        cleanupUploadedFiles(files);
        throw Object.assign(new Error('gpsLatitude must be between -90 and 90'), { statusCode: 400 });
      }
      gps = {
        type: 'Point',
        coordinates: [lon, lat],
        accuracy: data.gpsAccuracy !== undefined ? Number(data.gpsAccuracy) : undefined,
        capturedAt: data.gpsCapturedAt ? new Date(data.gpsCapturedAt) : undefined
      };
    }

    // Build evidence metadata — server-assigned UUIDs, never expose stored filenames
    const evidence: IEvidenceFile[] = files.map((f) => ({
      evidenceId: uuidv4(),
      originalMime: f.mimetype,
      storedFilename: f.filename,
      sizeBytes: f.size,
      uploadedAt: new Date()
    }));

    const inspectionId = await generateInspectionId();
    const inspectionDate = data.inspectionDate ? new Date(data.inspectionDate) : new Date();

    // Step a: Create inspection in PENDING state
    const inspection = new Inspection({
      inspectionId,
      status: 'PENDING',
      instrument: instrument._id,
      instrumentIdSnapshot: instrument.instrumentId,
      verificationRequest: vrf._id,
      inspector: caller._id,
      inspectionDate,
      referenceReading,
      actualReading,
      deviation,
      deviationPercentage,
      toleranceSnapshot,
      calculatedAssessment,
      inspectorResult: data.inspectorResult,
      overrideReason: resultMatchesCalculation ? undefined : data.overrideReason?.trim(),
      sealCondition: data.sealCondition?.trim(),
      displayCondition: data.displayCondition?.trim(),
      physicalDamage: data.physicalDamage?.trim(),
      nameplateCondition: data.nameplateCondition?.trim(),
      serialNumberMatch,
      potentialTamperingIndicators: data.potentialTamperingIndicators?.trim(),
      installationCondition: data.installationCondition?.trim(),
      remarks: data.remarks?.trim(),
      evidence,
      gps,
      submittedAt: new Date()
    });

    try {
      await inspection.save();
    } catch (err: any) {
      cleanupUploadedFiles(files);
      if (err.code === 11000) {
        throw Object.assign(
          new Error('An inspection already exists for this verification request'),
          { statusCode: 409 }
        );
      }
      throw err;
    }

    // Snapshot every VRF field this workflow will mutate — captured BEFORE any update.
    // Deep-clone statusHistory so we can restore the exact array without references.
    const priorSnapshot = {
      status: vrf.status,
      inspection: vrf.inspection,
      statusHistory: JSON.parse(JSON.stringify(vrf.statusHistory ?? [])),
      updatedBy: vrf.updatedBy,
      updatedAt: vrf.updatedAt
    };

    // Step b: Atomically update verification request only if still SCHEDULED and assigned
    const finalStatus = data.inspectorResult === 'PASS' ? 'PASSED' : 'FAILED';
    const now = new Date();
    const inspectionCompletedEvent = {
      status: 'INSPECTION_COMPLETED' as const,
      timestamp: now,
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks: `Field inspection completed. Inspection ID: ${inspectionId}`,
      metadata: { inspectionId, calculatedAssessment }
    };
    const finalEvent = {
      status: finalStatus as any,
      timestamp: new Date(now.getTime() + 1),
      changedBy: caller._id as mongoose.Types.ObjectId,
      remarks: resultMatchesCalculation
        ? `Inspector result: ${data.inspectorResult} (consistent with calculated assessment)`
        : `Inspector result: ${data.inspectorResult} (override: ${data.overrideReason?.trim()})`,
      metadata: { inspectorResult: data.inspectorResult, overridden: !resultMatchesCalculation }
    };

    let updatedVrf: any;
    try {
      updatedVrf = await VerificationRequest.findOneAndUpdate(
        {
          _id: vrf._id,
          status: 'SCHEDULED',
          assignedInspector: caller._id
        },
        {
          $set: {
            status: finalStatus,
            inspection: inspection._id,
            updatedBy: caller._id
          },
          $push: {
            statusHistory: { $each: [inspectionCompletedEvent, finalEvent] }
          }
        },
        { new: true }
      );
    } catch (vrfUpdateErr) {
      // VRF update itself threw — no VRF mutation occurred, safe to clean up immediately.
      await Inspection.deleteOne({ _id: inspection._id });
      cleanupUploadedFiles(files);
      throw vrfUpdateErr;
    }

    if (!updatedVrf) {
      // Concurrency conflict: request is no longer SCHEDULED or assigned to caller.
      // No VRF mutation occurred, safe to clean up immediately.
      await Inspection.deleteOne({ _id: inspection._id });
      cleanupUploadedFiles(files);
      throw Object.assign(
        new Error('Verification request is no longer in SCHEDULED state or assigned to you'),
        { statusCode: 409 }
      );
    }

    // Step c: Finalize the inspection after request update succeeds.
    // If finalization fails we must conditionally roll back the VRF update.
    try {
      inspection.status = 'FINALIZED';
      await inspection.save();
    } catch (finalizeErr) {
      // --- Compensation: conditional rollback of VRF ---
      // Only roll back if the VRF still reflects *this specific* workflow update
      // (guards against a concurrent modification that replaced our write).
      // Restore every snapshotted field exactly; use timestamps:false so Mongoose
      // does not generate a new updatedAt.
      let rollbackResult: any;
      try {
        const rollbackSet: Record<string, any> = {
          status: priorSnapshot.status,
          statusHistory: priorSnapshot.statusHistory,
          updatedBy: priorSnapshot.updatedBy,
          updatedAt: priorSnapshot.updatedAt
        };
        // Restore (or unset) the inspection field exactly as it was before.
        if (priorSnapshot.inspection == null) {
          rollbackSet.inspection = undefined;
        } else {
          rollbackSet.inspection = priorSnapshot.inspection;
        }

        rollbackResult = await VerificationRequest.findOneAndUpdate(
          {
            _id: vrf._id,
            status: finalStatus,
            inspection: inspection._id
          },
          { $set: rollbackSet, ...(priorSnapshot.inspection == null ? { $unset: { inspection: '' } } : {}) },
          { timestamps: false, new: false }
        );
      } catch (rollbackErr) {
        // Rollback threw — do NOT delete inspection or evidence (leaves a recoverable state).
        console.error('[InspectionService] Rollback failed after finalization failure:', rollbackErr);
        throw Object.assign(
          new Error('Inspection finalization failed and rollback could not be completed. Manual recovery required.'),
          { statusCode: 500 }
        );
      }

      if (!rollbackResult) {
        // Rollback query matched nothing — a concurrent modification replaced our write.
        // State is irrecoverable by us; preserve inspection and evidence for manual review.
        console.error('[InspectionService] Rollback skipped: VRF was concurrently modified after finalization failure.');
        throw Object.assign(
          new Error('Inspection finalization failed and rollback could not be completed. Manual recovery required.'),
          { statusCode: 500 }
        );
      }

      // Rollback succeeded — now safe to remove the stale PENDING inspection and its evidence.
      await Inspection.deleteOne({ _id: inspection._id });
      cleanupUploadedFiles(files);
      throw finalizeErr;
    }

    return inspection;
  }

  /**
   * Role-scoped listing of finalized inspections.
   *
   * OWNER scope is built strictly independently from user filters:
   * instrumentId or any query parameter CANNOT overwrite the mandatory owner constraint.
   */
  async listInspections(
    query: ListInspectionsQuery,
    caller: IUser
  ): Promise<{ data: IInspection[]; pagination: any }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    // Never expose pending or failed submissions
    const filter: Record<string, any> = {
      status: 'FINALIZED'
    };
    if (query.inspectorResult && ['PASS', 'FAIL'].includes(query.inspectorResult)) {
      filter.inspectorResult = query.inspectorResult;
    }

    if (caller.role === 'OWNER') {
      const ownedInstruments = await Instrument.find({ owner: caller._id }).select('_id instrumentId');
      const ownedIds = ownedInstruments.map((i) => i._id);

      if (query.instrumentId) {
        const targetInstrumentId = query.instrumentId.trim().toUpperCase();
        const matched = ownedInstruments.find((i) => i.instrumentId === targetInstrumentId);
        if (matched) {
          filter.instrument = matched._id;
        } else {
          // If instrumentId does not belong to this owner, return empty results without leaking existence
          filter.instrument = new mongoose.Types.ObjectId();
        }
      } else {
        filter.instrument = { $in: ownedIds };
      }
    } else {
      if (caller.role === 'INSPECTOR') {
        filter.inspector = caller._id;
      }
      if (query.inspectorId && mongoose.Types.ObjectId.isValid(query.inspectorId) && caller.role === 'ADMIN') {
        filter.inspector = new mongoose.Types.ObjectId(query.inspectorId);
      }
      if (query.instrumentId) {
        const inst = await Instrument.findOne({ instrumentId: query.instrumentId.trim().toUpperCase() });
        if (inst) {
          filter.instrument = inst._id;
        } else {
          filter.instrument = new mongoose.Types.ObjectId();
        }
      }
    }

    const [data, total] = await Promise.all([
      Inspection.find(filter)
        .populate('instrument', 'instrumentId type model')
        .populate('inspector', 'name email')
        .populate('verificationRequest', 'requestId status')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      Inspection.countDocuments(filter)
    ]);

    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  /**
   * Role-scoped retrieval of a single finalized inspection.
   */
  async getInspectionById(inspectionId: string, caller: IUser): Promise<IInspection> {
    const formatted = inspectionId.trim().toUpperCase();
    const inspection = await Inspection.findOne({ inspectionId: formatted, status: 'FINALIZED' })
      .populate('instrument', 'instrumentId type model owner')
      .populate('inspector', 'name email')
      .populate('verificationRequest', 'requestId status owner assignedInspector');

    if (!inspection) {
      throw Object.assign(new Error('Inspection not found'), { statusCode: 404 });
    }

    // OWNER: only own instruments (404 without leaking existence)
    if (caller.role === 'OWNER') {
      const instOwner =
        (inspection.instrument as any)?.owner?.toString() ||
        (await Instrument.findById(inspection.instrument))?.owner?.toString();
      if (instOwner !== caller._id.toString()) {
        throw Object.assign(new Error('Inspection not found'), { statusCode: 404 });
      }
    }

    // INSPECTOR: only their own inspections
    if (caller.role === 'INSPECTOR') {
      const inspectorId =
        (inspection.inspector as any)?._id?.toString() || inspection.inspector?.toString();
      if (inspectorId !== caller._id.toString()) {
        throw Object.assign(new Error('Inspection not found'), { statusCode: 404 });
      }
    }

    return inspection;
  }
}

export const inspectionService = new InspectionService();
