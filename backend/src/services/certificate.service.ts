import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Certificate, ICertificate, CertificateStatus } from '../models/certificate.model';
import { CertificatePolicy, ICertificatePolicy } from '../models/certificate-policy.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Inspection } from '../models/inspection.model';
import { Instrument } from '../models/instrument.model';
import { IUser } from '../models/user.model';
import { generatePolicyId, generateCertificateNumber } from '../utils/phase8-id.utils';
import { createIntegritySeal, verifyIntegritySeal } from '../utils/crypto-seal.utils';

export interface CreatePolicyDTO {
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  validityPeriodMonths: number;
}

export interface IssueCertificateDTO {
  verificationRequestId: string;
}

export class CertificateService {
  // Policy Management
  async createPolicy(data: CreatePolicyDTO, caller: IUser): Promise<ICertificatePolicy> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can create certificate policies'), { statusCode: 403 });
    }

    const policyId = await generatePolicyId();
    const policy = new CertificatePolicy({
      policyId,
      name: data.name.trim(),
      instrumentType: data.instrumentType.trim(),
      instrumentCategory: data.instrumentCategory.trim(),
      validityPeriodMonths: Math.max(1, Math.min(120, Number(data.validityPeriodMonths) || 12)),
      effectiveFrom: new Date(),
      isActive: false, // newly created policy inactive by default
      version: 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await policy.save();
    return policy;
  }

  async activatePolicy(policyId: string, caller: IUser): Promise<ICertificatePolicy> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can activate certificate policies'), { statusCode: 403 });
    }

    const policy = await CertificatePolicy.findOne({ policyId: policyId.trim().toUpperCase() });
    if (!policy) {
      throw Object.assign(new Error('Certificate policy not found'), { statusCode: 404 });
    }

    // Deactivate existing active policy for same instrumentType & instrumentCategory
    await CertificatePolicy.updateMany(
      { instrumentType: policy.instrumentType, instrumentCategory: policy.instrumentCategory, isActive: true },
      { $set: { isActive: false, updatedBy: caller._id } }
    );

    policy.isActive = true;
    (policy as any).updatedBy = caller._id;
    await policy.save();
    return policy;
  }

  async softDeactivatePolicy(policyId: string, caller: IUser): Promise<ICertificatePolicy> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can deactivate certificate policies'), { statusCode: 403 });
    }

    const policy = await CertificatePolicy.findOne({ policyId: policyId.trim().toUpperCase() });
    if (!policy) {
      throw Object.assign(new Error('Certificate policy not found'), { statusCode: 404 });
    }

    policy.isActive = false;
    (policy as any).updatedBy = caller._id;
    await policy.save();
    return policy;
  }

  async listPolicies(caller: IUser): Promise<ICertificatePolicy[]> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Access forbidden'), { statusCode: 403 });
    }
    return CertificatePolicy.find({}).sort({ createdAt: -1 });
  }

  // Certificate Issuance
  async issueCertificate(dto: IssueCertificateDTO, caller: IUser): Promise<ICertificate> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can issue digital certificates'), { statusCode: 403 });
    }

    const vreq = await VerificationRequest.findOne({ requestId: dto.verificationRequestId.trim().toUpperCase() })
      .populate('instrument')
      .populate('owner');

    if (!vreq) {
      throw Object.assign(new Error('Verification request not found'), { statusCode: 404 });
    }

    if (vreq.status !== 'PASSED') {
      throw Object.assign(
        new Error(`Cannot issue certificate: Verification request status must be PASSED (current status: ${vreq.status})`),
        { statusCode: 409 }
      );
    }

    const inspection = await Inspection.findOne({ verificationRequest: vreq._id, status: 'FINALIZED' });
    if (!inspection || inspection.inspectorResult !== 'PASS') {
      throw Object.assign(
        new Error('Cannot issue certificate: No finalized PASS inspection found for this verification request'),
        { statusCode: 422 }
      );
    }

    // Check database uniqueness guard for certificate
    const existingCert = await Certificate.findOne({ verificationRequest: vreq._id });
    if (existingCert) {
      throw Object.assign(new Error('A certificate has already been issued for this verification request'), { statusCode: 409 });
    }

    const inst = vreq.instrument as any;

    const activePolicy = await CertificatePolicy.findOne({
      instrumentType: inst.type,
      instrumentCategory: inst.category,
      isActive: true
    });

    const policySnapshot = {
      policyId: activePolicy ? activePolicy.policyId : 'POL-DEFAULT',
      name: activePolicy ? activePolicy.name : 'Default 12-Month Statutory Policy',
      validityPeriodMonths: activePolicy ? activePolicy.validityPeriodMonths : 12,
      version: activePolicy ? activePolicy.version : 1
    };

    const now = new Date();
    const validFrom = now;
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + policySnapshot.validityPeriodMonths);

    const year = now.getFullYear();
    const certificateNumber = await generateCertificateNumber(year);
    const publicVerificationId = uuidv4();

    // Mask serial number for safe public snapshots
    const sn = inst.serialNumber || 'UNKNOWN';
    const maskedSerialNumber = sn.length > 4
      ? `${sn.substring(0, 2)}****${sn.substring(sn.length - 2)}`
      : '****';

    const safePayload = {
      certificateNumber,
      publicVerificationId,
      instrumentId: inst.instrumentId,
      type: inst.type,
      category: inst.category,
      manufacturer: inst.manufacturer,
      model: inst.model,
      maskedSerialNumber,
      verificationDate: inspection.inspectionDate.toISOString(),
      issuedAt: now.toISOString(),
      validFrom: validFrom.toISOString(),
      expiresAt: expiresAt.toISOString(),
      inspectorResult: inspection.inspectorResult
    };

    const seal = createIntegritySeal(safePayload);

    // Save previous state snapshots for failure-safe compensating rollback
    const origReqStatus = vreq.status;
    const origReqStatusHistory = [...vreq.statusHistory];
    const origInstCert = inst.currentCertificate;
    const origInstHistory = [...inst.lifecycleHistory];

    try {
      // Create Certificate
      const cert = new Certificate({
        certificateNumber,
        publicVerificationId,
        instrument: inst._id,
        owner: vreq.owner._id,
        verificationRequest: vreq._id,
        inspection: inspection._id,
        instrumentSnapshot: {
          instrumentId: inst.instrumentId,
          type: inst.type,
          category: inst.category,
          manufacturer: inst.manufacturer,
          model: inst.model,
          maskedSerialNumber,
          capacity: inst.capacity
        },
        verificationSnapshot: {
          requestId: vreq.requestId,
          verificationType: vreq.verificationType
        },
        inspectionSnapshot: {
          inspectionId: inspection.inspectionId,
          inspectorResult: inspection.inspectorResult,
          calculatedAssessment: inspection.calculatedAssessment,
          referenceReading: inspection.referenceReading,
          actualReading: inspection.actualReading,
          deviation: inspection.deviation,
          deviationPercentage: inspection.deviationPercentage
        },
        verificationDate: inspection.inspectionDate,
        issuedAt: now,
        validFrom,
        expiresAt,
        status: 'VALID',
        policySnapshot,
        integrityMetadata: {
          payloadHash: seal.payloadHash,
          hmacSeal: seal.hmacSeal,
          algorithm: seal.algorithm,
          label: seal.label
        },
        revocationHistory: [],
        createdBy: caller._id
      });

      await cert.save();

      // Supersede any existing valid certificate for instrument
      await Certificate.updateMany(
        { instrument: inst._id, _id: { $ne: cert._id }, status: 'VALID' },
        { $set: { status: 'SUPERSEDED' } }
      );

      // Update VerificationRequest
      vreq.status = 'CERTIFICATE_ISSUED';
      vreq.statusHistory.push({
        status: 'CERTIFICATE_ISSUED',
        timestamp: now,
        changedBy: caller._id as any,
        remarks: `Digital Certificate issued (${certificateNumber})`
      });
      vreq.updatedBy = caller._id as any;
      await vreq.save();

      // Update Instrument currentCertificate & lifecycle history
      inst.currentCertificate = {
        certificateNumber,
        issueDate: validFrom,
        expiryDate: expiresAt,
        verifierId: inspection.inspector
      };
      inst.lifecycleHistory.push({
        eventType: 'CERTIFICATE_ISSUED',
        timestamp: now,
        performedBy: caller._id as any,
        description: `Digital Certificate ${certificateNumber} issued. Valid until ${expiresAt.toISOString().split('T')[0]}.`
      });
      inst.updatedBy = caller._id as any;
      await inst.save();

      return cert;
    } catch (err: any) {
      // Compensating rollback on failure
      await VerificationRequest.updateOne(
        { _id: vreq._id },
        { $set: { status: origReqStatus, statusHistory: origReqStatusHistory } }
      );
      await Instrument.updateOne(
        { _id: inst._id },
        { $set: { currentCertificate: origInstCert, lifecycleHistory: origInstHistory } }
      );
      await Certificate.deleteOne({ certificateNumber });
      throw err;
    }
  }

  async revokeCertificate(certificateNumber: string, reason: string, caller: IUser): Promise<ICertificate> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can revoke certificates'), { statusCode: 403 });
    }

    if (!reason || reason.trim().length < 5) {
      throw Object.assign(new Error('A mandatory revocation reason (at least 5 characters) is required'), { statusCode: 400 });
    }

    const cert = await Certificate.findOne({ certificateNumber: certificateNumber.trim().toUpperCase() });
    if (!cert) {
      throw Object.assign(new Error('Certificate not found'), { statusCode: 404 });
    }

    if (cert.status === 'REVOKED') {
      throw Object.assign(new Error('Certificate is already revoked'), { statusCode: 409 });
    }

    const now = new Date();
    cert.status = 'REVOKED';
    cert.revocationHistory.push({
      status: 'REVOKED',
      timestamp: now,
      changedBy: caller._id as any,
      reason: reason.trim()
    });

    await cert.save();

    // Update instrument lifecycle history
    await Instrument.updateOne(
      { _id: cert.instrument },
      {
        $push: {
          lifecycleHistory: {
            eventType: 'CERTIFICATE_REVOKED',
            timestamp: now,
            performedBy: caller._id,
            description: `Certificate ${cert.certificateNumber} revoked. Reason: ${reason.trim()}`
          }
        }
      }
    );

    return cert;
  }

  async getCertificateByNumber(certificateNumber: string, caller: IUser): Promise<ICertificate> {
    const cert = await Certificate.findOne({ certificateNumber: certificateNumber.trim().toUpperCase() })
      .populate('instrument')
      .populate('owner', 'name email -_id');

    if (!cert) {
      throw Object.assign(new Error('Certificate not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER' && cert.owner.toString() !== (caller._id as any).toString()) {
      throw Object.assign(new Error('Certificate not found'), { statusCode: 404 });
    }

    // Verify tamper-evident integrity seal
    const safePayload = {
      certificateNumber: cert.certificateNumber,
      publicVerificationId: cert.publicVerificationId,
      instrumentId: cert.instrumentSnapshot.instrumentId,
      type: cert.instrumentSnapshot.type,
      category: cert.instrumentSnapshot.category,
      manufacturer: cert.instrumentSnapshot.manufacturer,
      model: cert.instrumentSnapshot.model,
      maskedSerialNumber: cert.instrumentSnapshot.maskedSerialNumber,
      verificationDate: cert.verificationDate.toISOString(),
      issuedAt: cert.issuedAt.toISOString(),
      validFrom: cert.validFrom.toISOString(),
      expiresAt: cert.expiresAt.toISOString(),
      inspectorResult: cert.inspectionSnapshot.inspectorResult
    };

    const isIntegrityValid = verifyIntegritySeal(
      safePayload,
      cert.integrityMetadata.payloadHash,
      cert.integrityMetadata.hmacSeal
    );

    if (!isIntegrityValid) {
      (cert as any).integrityMetadata.label = 'POSSIBLE_TAMPERING_DETECTED: Hash or HMAC mismatch';
    }

    return cert;
  }

  async listCertificates(caller: IUser): Promise<ICertificate[]> {
    if (caller.role === 'OWNER') {
      return Certificate.find({ owner: caller._id }).sort({ createdAt: -1 });
    }
    return Certificate.find({}).sort({ createdAt: -1 });
  }
}

export const certificateService = new CertificateService();
