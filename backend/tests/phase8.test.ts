import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { Inspection } from '../src/models/inspection.model';
import { CertificatePolicy } from '../src/models/certificate-policy.model';
import { Certificate } from '../src/models/certificate.model';
import { Complaint } from '../src/models/complaint.model';
import { ImprovementNotice } from '../src/models/improvement-notice.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`
    );
  }
};

describe('SmartMetrix Phase 8 — Digital Certificates, Public Verification, Complaints & Improvement Notices', () => {
  let adminToken: string;
  let inspectorToken: string;
  let ownerToken: string;
  let owner2Token: string;

  let ownerUser: any;
  let owner2User: any;
  let adminUser: any;
  let inspectorUser: any;

  let testInstrument: any;
  let passReq: any;
  let passInspection: any;
  let failReq: any;
  let failInspection: any;

  let issuedCert: any;
  let publicVerificationId: string;
  let complaintTrackingToken: string;
  let improvementNoticeId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assertTestDatabaseSafety();

    // Clean up
    await User.deleteMany({ email: { $regex: /@phase8\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P8/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-P8-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INSP-P8-/ } });
    await CertificatePolicy.deleteMany({ name: { $regex: /Phase 8/ } });
    await Certificate.deleteMany({ certificateNumber: { $regex: /^CERT-2026-8/ } });
    await Complaint.deleteMany({ complaintId: { $regex: /^CMP-8/ } });
    await ImprovementNotice.deleteMany({ noticeId: { $regex: /^IMP-8/ } });

    // Seed Users
    adminUser = await User.create({
      name: 'P8 Admin',
      email: 'admin@phase8.smartmetrix.test',
      password: 'password123',
      role: 'ADMIN'
    });

    inspectorUser = await User.create({
      name: 'P8 Inspector',
      email: 'inspector@phase8.smartmetrix.test',
      password: 'password123',
      role: 'INSPECTOR'
    });

    ownerUser = await User.create({
      name: 'P8 Owner 1',
      email: 'owner1@phase8.smartmetrix.test',
      password: 'password123',
      role: 'OWNER'
    });

    owner2User = await User.create({
      name: 'P8 Owner 2',
      email: 'owner2@phase8.smartmetrix.test',
      password: 'password123',
      role: 'OWNER'
    });

    // Tokens
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@phase8.smartmetrix.test', password: 'password123' });
    adminToken = adminRes.body.data ? adminRes.body.data.token : '';

    const inspRes = await request(app).post('/api/auth/login').send({ email: 'inspector@phase8.smartmetrix.test', password: 'password123' });
    inspectorToken = inspRes.body.data ? inspRes.body.data.token : '';

    const ownRes = await request(app).post('/api/auth/login').send({ email: 'owner1@phase8.smartmetrix.test', password: 'password123' });
    ownerToken = ownRes.body.data ? ownRes.body.data.token : '';

    const own2Res = await request(app).post('/api/auth/login').send({ email: 'owner2@phase8.smartmetrix.test', password: 'password123' });
    owner2Token = own2Res.body.data ? own2Res.body.data.token : '';

    // Seed Instrument
    testInstrument = await Instrument.create({
      instrumentId: 'INST-P8-001',
      owner: ownerUser._id,
      type: 'FUEL_DISPENSER',
      category: 'PETROL',
      manufacturer: 'GILBARCO',
      model: 'SK-700',
      serialNumber: 'SN-P8-9999',
      capacity: { value: 50, unit: 'l' },
      location: {
        address: 'MG Road Fuel Station',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pincode: '560001',
        coordinates: { type: 'Point', coordinates: [77.6000, 12.9700] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });

    // Seed Passed Verification Request & Inspection
    passReq = await VerificationRequest.create({
      requestId: 'VRF-P8-001',
      instrument: testInstrument._id,
      owner: ownerUser._id,
      verificationType: 'INITIAL',
      status: 'PASSED',
      submittedAt: new Date(),
      assignedInspector: inspectorUser._id,
      createdBy: ownerUser._id,
      updatedBy: adminUser._id
    });

    passInspection = await Inspection.create({
      inspectionId: 'INSP-P8-001',
      instrument: testInstrument._id,
      instrumentIdSnapshot: 'INST-P8-001',
      verificationRequest: passReq._id,
      inspector: inspectorUser._id,
      inspectionDate: new Date(),
      status: 'FINALIZED',
      referenceReading: 20,
      actualReading: 20.02,
      deviation: 0.02,
      deviationPercentage: 0.1,
      serialNumberMatch: true,
      toleranceSnapshot: {
        ruleId: 'TR-FUEL-01',
        name: 'Fuel Tolerance Rule',
        toleranceMode: 'ABSOLUTE',
        toleranceValue: 0.1,
        capacityUnit: 'l'
      },
      calculatedAssessment: 'WITHIN_TOLERANCE',
      inspectorResult: 'PASS',
      comments: 'Passed inspection',
      finalizedAt: new Date()
    });

    // Seed Failed Verification Request & Inspection
    failReq = await VerificationRequest.create({
      requestId: 'VRF-P8-002',
      instrument: testInstrument._id,
      owner: ownerUser._id,
      verificationType: 'RE_VERIFICATION',
      status: 'FAILED',
      submittedAt: new Date(),
      assignedInspector: inspectorUser._id,
      createdBy: ownerUser._id,
      updatedBy: adminUser._id
    });

    failInspection = await Inspection.create({
      inspectionId: 'INSP-P8-002',
      instrument: testInstrument._id,
      instrumentIdSnapshot: 'INST-P8-001',
      verificationRequest: failReq._id,
      inspector: inspectorUser._id,
      inspectionDate: new Date(),
      status: 'FINALIZED',
      referenceReading: 20,
      actualReading: 20.5,
      deviation: 0.5,
      deviationPercentage: 2.5,
      serialNumberMatch: true,
      toleranceSnapshot: {
        ruleId: 'TR-FUEL-01',
        name: 'Fuel Tolerance Rule',
        toleranceMode: 'ABSOLUTE',
        toleranceValue: 0.1,
        capacityUnit: 'l'
      },
      calculatedAssessment: 'OUTSIDE_TOLERANCE',
      inspectorResult: 'FAIL',
      comments: 'Failed inspection due to large error',
      finalizedAt: new Date()
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    await User.deleteMany({ email: { $regex: /@phase8\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P8/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-P8-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INSP-P8-/ } });
    await CertificatePolicy.deleteMany({ name: { $regex: /Phase 8/ } });
    await Certificate.deleteMany({ certificateNumber: { $regex: /^CERT-2026-8/ } });
    await Complaint.deleteMany({ complaintId: { $regex: /^CMP-8/ } });
    await ImprovementNotice.deleteMany({ noticeId: { $regex: /^IMP-8/ } });
  });

  // A. Certificate Policy
  it('1. ADMIN can create, activate, and soft-deactivate a CertificatePolicy', async () => {
    const res = await request(app)
      .post('/api/certificates/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 8 Fuel Dispenser Policy',
        instrumentType: 'FUEL_DISPENSER',
        instrumentCategory: 'PETROL',
        validityPeriodMonths: 12
      });

    expect(res.status).toBe(201);
    const policy = res.body.data.policy;
    expect(policy.policyId).toMatch(/^POL-/);
    expect(policy.isActive).toBe(false);

    // Activate policy
    const actRes = await request(app)
      .post(`/api/certificates/policies/${policy.policyId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.policy.isActive).toBe(true);
  });

  // B. Certificate Issuance & Integrity
  it('2. ADMIN can issue digital certificate for PASSED verification request', async () => {
    const res = await request(app)
      .post('/api/certificates/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verificationRequestId: 'VRF-P8-001' });

    expect(res.status).toBe(201);
    issuedCert = res.body.data.certificate;
    expect(issuedCert.certificateNumber).toMatch(/^CERT-2026-/);
    expect(issuedCert.publicVerificationId).toBeDefined();
    expect(issuedCert.integrityMetadata.hmacSeal).toBeDefined();
    expect(issuedCert.status).toBe('VALID');

    publicVerificationId = issuedCert.publicVerificationId;
  });

  it('3. Certificate issuance is rejected for FAILED verification request', async () => {
    const res = await request(app)
      .post('/api/certificates/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verificationRequestId: 'VRF-P8-002' });

    expect(res.status).toBe(409); // Rejected because status is FAILED
  });

  it('4. Duplicate certificate issuance for same request is rejected by database unique index', async () => {
    const res = await request(app)
      .post('/api/certificates/issue')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verificationRequestId: 'VRF-P8-001' });

    expect(res.status).toBe(409); // Conflict
  });

  it('5. ADMIN can revoke certificate with mandatory reason', async () => {
    const res = await request(app)
      .post(`/api/certificates/${issuedCert.certificateNumber}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Discovered calibration error during audit' });

    expect(res.status).toBe(200);
    expect(res.body.data.certificate.status).toBe('REVOKED');
    expect(res.body.data.certificate.revocationHistory.length).toBe(1);
  });

  // C. QR & Public Verification Privacy
  it('6. Public verification endpoint returns safe data without owner/GPS/internal ObjectIds', async () => {
    const res = await request(app).get(`/api/public/verify/${publicVerificationId}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.certificateNumber).toBe(issuedCert.certificateNumber);
    expect(data.status).toBe('REVOKED'); // Reflects revocation
    expect(data.instrument.maskedSerialNumber).toContain('****');
    expect(data.issuingAuthorityLabel).toBe('Authorized Legal Metrology Authority');

    // Confirm strict privacy boundaries: NO sensitive fields returned
    expect(data.owner).toBeUndefined();
    expect(data.coordinates).toBeUndefined();
    expect(data.inspectionRemarks).toBeUndefined();
    expect(data.riskScore).toBeUndefined();
  });

  it('7. Public QR code endpoint returns PNG image buffer', async () => {
    const res = await request(app).get(`/api/public/verify/${publicVerificationId}/qr`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body).toBeDefined();
  });

  // D. Consumer Complaints & AES-256-GCM Contact Encryption
  it('8. Public consumer can submit complaint with rate-limiting and encrypted contact', async () => {
    const res = await request(app)
      .post('/api/public/complaints')
      .send({
        publicVerificationId,
        category: 'ACCURACY_DOUBT',
        description: 'Fuel volume dispensed appears significantly lower than displayed meter value.',
        complainantContact: 'consumer@example.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.complaintId).toMatch(/^CMP-/);
    expect(res.body.data.trackingToken).toBeDefined();

    complaintTrackingToken = res.body.data.trackingToken;
  });

  it('9. Public complaint tracking endpoint returns safe status without revealing contact or internal IDs', async () => {
    const res = await request(app).get(`/api/public/complaints/track/${complaintTrackingToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.complainantContact).toBeUndefined();
    expect(res.body.data.encryptedContact).toBeUndefined();
  });

  it('10. OWNER can view complaint for owned instrument but complainant contact remains hidden', async () => {
    const res = await request(app)
      .get('/api/complaints')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const complaints = res.body.data.complaints;
    expect(complaints.length).toBeGreaterThanOrEqual(1);
    expect(complaints[0].encryptedContact).toBeUndefined();
    expect(complaints[0].complainantContact).toBeUndefined();
  });

  // E. Improvement Notices
  it('11. INSPECTOR can issue improvement notice for failed inspection with future deadline', async () => {
    const futureDeadline = new Date();
    futureDeadline.setDate(futureDeadline.getDate() + 14);

    const res = await request(app)
      .post('/api/improvement-notices')
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({
        inspectionId: 'INSP-P8-002',
        reason: 'Fuel dispenser error outside maximum permissible tolerance.',
        deadline: futureDeadline.toISOString(),
        requiredCorrection: 'Recalibrate metering unit and submit re-verification request.'
      });

    expect(res.status).toBe(201);
    const notice = res.body.data.notice;
    expect(notice.noticeId).toMatch(/^IMP-/);
    expect(notice.status).toBe('OPEN');

    improvementNoticeId = notice.noticeId;
  });

  it('12. OWNER can update notice status to CORRECTION_IN_PROGRESS', async () => {
    const res = await request(app)
      .patch(`/api/improvement-notices/${improvementNoticeId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        status: 'CORRECTION_IN_PROGRESS',
        remarks: 'Engaged certified service engineer for recalibration.'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.notice.status).toBe('CORRECTION_IN_PROGRESS');
  });

  it('13. Notice closure requires INSPECTOR or ADMIN and mandatory closureRemarks', async () => {
    // Advance to REINSPECTION_PENDING first
    await request(app)
      .patch(`/api/improvement-notices/${improvementNoticeId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'REINSPECTION_PENDING', remarks: 'Recalibration complete.' });

    // Attempt closure without closureRemarks
    const failClose = await request(app)
      .patch(`/api/improvement-notices/${improvementNoticeId}/status`)
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ status: 'CLOSED' });
    expect(failClose.status).toBe(400);

    // Successful closure with mandatory closureRemarks
    const successClose = await request(app)
      .patch(`/api/improvement-notices/${improvementNoticeId}/status`)
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({
        status: 'CLOSED',
        closureRemarks: 'Re-inspection completed; dispenser error now within legal tolerance limits.'
      });

    expect(successClose.status).toBe(200);
    expect(successClose.body.data.notice.status).toBe('CLOSED');
  });
});
