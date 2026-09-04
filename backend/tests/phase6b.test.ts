import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { ToleranceRule } from '../src/models/tolerance-rule.model';
import { Inspection } from '../src/models/inspection.model';
import { AnomalyAssessment } from '../src/models/anomaly-assessment.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

// Tracked IDs for targeted cleanup
const createdUserIds: mongoose.Types.ObjectId[] = [];
const createdInstrumentIds: mongoose.Types.ObjectId[] = [];
const createdVerificationIds: mongoose.Types.ObjectId[] = [];
const createdRuleIds: mongoose.Types.ObjectId[] = [];
const createdInspectionIds: mongoose.Types.ObjectId[] = [];
const createdAssessmentIds: mongoose.Types.ObjectId[] = [];

/**
 * Test Database Safety Guard:
 * Strictly ensures operations only execute if connected to 'smartmetrix_test'.
 */
export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`
    );
  }
};

describe('Phase 6B Integration Tests: Isolation Forest Anomaly Detection', () => {
  let adminToken: string;
  let adminId: string;
  let inspectorToken: string;
  let inspectorId: string;
  let owner1Token: string;
  let owner1Id: string;
  let owner2Token: string;
  let owner2Id: string;

  // Instrument with good (PASS) inspection history
  let instrument1Id: string;
  let instrument1MongoId: mongoose.Types.ObjectId;

  // Instrument with bad (FAIL) inspection history
  let instrument2Id: string;
  let instrument2MongoId: mongoose.Types.ObjectId;

  // Instrument with zero inspections
  let instrumentNoDataId: string;
  let instrumentNoDataMongoId: mongoose.Types.ObjectId;

  let toleranceRuleId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.JWT_EXPIRES_IN = '1h';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    assertTestDatabaseSafety();

    await AnomalyAssessment.syncIndexes();
    await Inspection.syncIndexes();
    await Instrument.syncIndexes();
    await User.syncIndexes();

    const ts = Date.now();

    // 1. Seed Users
    const admin = new User({
      name: 'Admin 6B',
      email: `admin6b_${ts}@test.local`,
      password: 'AdminPassword123!',
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });
    await admin.save();
    createdUserIds.push(admin._id as mongoose.Types.ObjectId);
    adminId = admin._id.toString();

    const inspector = new User({
      name: 'Inspector 6B',
      email: `inspector6b_${ts}@test.local`,
      password: 'InspectorPassword123!',
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });
    await inspector.save();
    createdUserIds.push(inspector._id as mongoose.Types.ObjectId);
    inspectorId = inspector._id.toString();

    const owner1 = new User({
      name: 'Owner 6B A',
      email: `owner6ba_${ts}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner1.save();
    createdUserIds.push(owner1._id as mongoose.Types.ObjectId);
    owner1Id = owner1._id.toString();

    const owner2 = new User({
      name: 'Owner 6B B',
      email: `owner6bb_${ts}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner2.save();
    createdUserIds.push(owner2._id as mongoose.Types.ObjectId);
    owner2Id = owner2._id.toString();

    // Logins
    const [resAdm, resInsp, resO1, resO2] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: admin.email, password: 'AdminPassword123!' }),
      request(app).post('/api/auth/login').send({ email: inspector.email, password: 'InspectorPassword123!' }),
      request(app).post('/api/auth/login').send({ email: owner1.email, password: 'OwnerPassword123!' }),
      request(app).post('/api/auth/login').send({ email: owner2.email, password: 'OwnerPassword123!' })
    ]);

    adminToken = resAdm.body.data.token;
    inspectorToken = resInsp.body.data.token;
    owner1Token = resO1.body.data.token;
    owner2Token = resO2.body.data.token;

    // 2. Seed Tolerance Rule
    const rule = new ToleranceRule({
      ruleId: `TOL-6B-${ts}`,
      name: 'Standard Weight Rule 6B',
      instrumentType: 'WEIGHING_SCALE',
      instrumentCategory: 'NON_AUTOMATIC_WEIGHING',
      capacityMin: 0,
      capacityMax: 100,
      capacityUnit: 'kg',
      toleranceMode: 'PERCENTAGE',
      toleranceValue: 1.0, // 1%
      effectiveFrom: new Date(Date.now() - 86400000),
      isActive: true,
      version: 1,
      createdBy: admin._id,
      updatedBy: admin._id
    });
    await rule.save();
    createdRuleIds.push(rule._id as mongoose.Types.ObjectId);
    toleranceRuleId = rule.ruleId;

    // 3. Seed Instrument 1 (Owner 1 — compliant, within-tolerance history)
    const inst1 = new Instrument({
      instrumentId: `WM-CHE-6B01-${ts}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Essae Metrology',
      model: 'DS-215',
      serialNumber: `SN-6B-1-${ts}`,
      capacity: { value: 15, unit: 'kg' },
      location: {
        address: '10 Anna Salai',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
      },
      status: 'ACTIVE',
      currentCertificate: {
        certificateNumber: 'CERT-6B-VALID',
        issueDate: new Date(Date.now() - 30 * 86400000),
        expiryDate: new Date(Date.now() + 335 * 86400000),
        verifierId: inspector._id
      },
      createdBy: owner1._id,
      updatedBy: owner1._id
    });
    await inst1.save();
    createdInstrumentIds.push(inst1._id as mongoose.Types.ObjectId);
    instrument1Id = inst1.instrumentId;
    instrument1MongoId = inst1._id as mongoose.Types.ObjectId;

    // 4. Seed Instrument 2 (Owner 2 — high deviation, FAIL history)
    const inst2 = new Instrument({
      instrumentId: `WM-CHE-6B02-${ts}`,
      owner: owner2._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Avery Weightronix',
      model: 'E-1010',
      serialNumber: `SN-6B-2-${ts}`,
      capacity: { value: 50, unit: 'kg' },
      location: {
        address: '20 Mount Road',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        coordinates: { type: 'Point', coordinates: [80.26, 13.07] }
      },
      status: 'ACTIVE',
      createdBy: owner2._id,
      updatedBy: owner2._id
    });
    await inst2.save();
    createdInstrumentIds.push(inst2._id as mongoose.Types.ObjectId);
    instrument2Id = inst2.instrumentId;
    instrument2MongoId = inst2._id as mongoose.Types.ObjectId;

    // 5. Seed Instrument No Data (Owner 1 — zero inspections)
    const instNoData = new Instrument({
      instrumentId: `WM-CHE-6B03-${ts}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Citizen Scales',
      model: 'CZ-30',
      serialNumber: `SN-6B-3-${ts}`,
      capacity: { value: 30, unit: 'kg' },
      location: {
        address: '30 Gandhi Road',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        coordinates: { type: 'Point', coordinates: [80.25, 13.06] }
      },
      status: 'REGISTERED',
      createdBy: owner1._id,
      updatedBy: owner1._id
    });
    await instNoData.save();
    createdInstrumentIds.push(instNoData._id as mongoose.Types.ObjectId);
    instrumentNoDataId = instNoData.instrumentId;
    instrumentNoDataMongoId = instNoData._id as mongoose.Types.ObjectId;

    // 6. Seed Finalized Inspections for Instrument 1 (PASS, low deviation)
    for (let i = 1; i <= 2; i++) {
      const vrf = new VerificationRequest({
        requestId: `VRF-6B1-${i}-${ts}`,
        instrument: inst1._id,
        owner: owner1._id,
        verificationType: 'INITIAL',
        status: i === 2 ? 'PASSED' : 'CLOSED',
        createdBy: owner1._id,
        updatedBy: admin._id
      });
      await vrf.save();
      createdVerificationIds.push(vrf._id as mongoose.Types.ObjectId);

      const insp = new Inspection({
        inspectionId: `INS-6B1-${i}-${ts}`,
        status: 'FINALIZED',
        instrument: inst1._id,
        instrumentIdSnapshot: inst1.instrumentId,
        verificationRequest: vrf._id,
        inspector: inspector._id,
        inspectionDate: new Date(Date.now() - i * 10 * 86400000),
        referenceReading: 10,
        actualReading: 10.02,
        deviation: 0.02,
        deviationPercentage: 0.2,
        toleranceSnapshot: {
          ruleId: toleranceRuleId,
          name: 'Standard Weight Rule 6B',
          toleranceMode: 'PERCENTAGE',
          toleranceValue: 1.0,
          capacityUnit: 'kg'
        },
        calculatedAssessment: 'WITHIN_TOLERANCE',
        inspectorResult: 'PASS',
        serialNumberMatch: true,
        submittedAt: new Date(Date.now() - i * 10 * 86400000)
      });
      await insp.save();
      createdInspectionIds.push(insp._id as mongoose.Types.ObjectId);
    }

    // 7. Seed Finalized Inspection for Instrument 2 (FAIL, high deviation)
    const vrf2 = new VerificationRequest({
      requestId: `VRF-6B2-1-${ts}`,
      instrument: inst2._id,
      owner: owner2._id,
      verificationType: 'INITIAL',
      status: 'FAILED',
      createdBy: owner2._id,
      updatedBy: admin._id
    });
    await vrf2.save();
    createdVerificationIds.push(vrf2._id as mongoose.Types.ObjectId);

    const insp2 = new Inspection({
      inspectionId: `INS-6B2-1-${ts}`,
      status: 'FINALIZED',
      instrument: inst2._id,
      instrumentIdSnapshot: inst2.instrumentId,
      verificationRequest: vrf2._id,
      inspector: inspector._id,
      inspectionDate: new Date(Date.now() - 5 * 86400000),
      referenceReading: 50,
      actualReading: 54, // 8% deviation
      deviation: 4,
      deviationPercentage: 8.0,
      toleranceSnapshot: {
        ruleId: toleranceRuleId,
        name: 'Standard Weight Rule 6B',
        toleranceMode: 'PERCENTAGE',
        toleranceValue: 1.0,
        capacityUnit: 'kg'
      },
      calculatedAssessment: 'OUTSIDE_TOLERANCE',
      inspectorResult: 'FAIL',
      serialNumberMatch: true,
      submittedAt: new Date(Date.now() - 5 * 86400000)
    });
    await insp2.save();
    createdInspectionIds.push(insp2._id as mongoose.Types.ObjectId);
  });

  afterAll(async () => {
    assertTestDatabaseSafety();

    if (createdAssessmentIds.length > 0) {
      await AnomalyAssessment.deleteMany({ _id: { $in: createdAssessmentIds } });
    }
    if (createdInspectionIds.length > 0) {
      await Inspection.deleteMany({ _id: { $in: createdInspectionIds } });
    }
    if (createdVerificationIds.length > 0) {
      await VerificationRequest.deleteMany({ _id: { $in: createdVerificationIds } });
    }
    if (createdInstrumentIds.length > 0) {
      await Instrument.deleteMany({ _id: { $in: createdInstrumentIds } });
    }
    if (createdRuleIds.length > 0) {
      await ToleranceRule.deleteMany({ _id: { $in: createdRuleIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    await mongoose.disconnect();
  });

  // ===========================================================================
  // 1. Role-gating and authentication guards
  // ===========================================================================
  describe('1. Role Access Guards', () => {
    it('returns 401 if no auth token is provided (401)', async () => {
      const res = await request(app).post(`/api/anomaly/instruments/${instrument1Id}/analyze`);
      expect(res.status).toBe(401);
    });

    it('forbids OWNER from triggering anomaly analysis (403)', async () => {
      const res = await request(app)
        .post(`/api/anomaly/instruments/${instrument1Id}/analyze`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });

    it('forbids OWNER from accessing potential-anomalies list (403)', async () => {
      const res = await request(app)
        .get('/api/anomaly/potential-anomalies')
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });

    it('forbids OWNER from triggering batch analysis (403)', async () => {
      const res = await request(app)
        .post('/api/anomaly/batch')
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 2. Instrument with no finalized inspections → INSUFFICIENT_DATA
  // ===========================================================================
  describe('2. Instrument With No Inspection History', () => {
    it('returns INSUFFICIENT_DATA assessment for instrument with zero finalized inspections (201)', async () => {
      const res = await request(app)
        .post(`/api/anomaly/instruments/${instrumentNoDataId}/analyze`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      const a = res.body.data.assessment;

      expect(a.assessmentId).toMatch(/^ANO-\d{4}-\d{5}$/);
      expect(a.instrumentIdSnapshot).toBe(instrumentNoDataId);
      expect(a.status).toBe('INSUFFICIENT_DATA');
      expect(a.method).toBe('INSUFFICIENT_DATA');
      expect(a.potentialAnomaly).toBe(false);
      expect(a.anomalyScore).toBeNull();
      expect(a.confidence).toBeNull();

      // Decision support disclaimer must be present
      expect(a.disclaimer).toMatch(/decision support only/i);
      // Must not contain defamatory certainty language
      expect(a.disclaimer.toLowerCase()).not.toContain('confirmed fraud');
      expect(a.disclaimer.toLowerCase()).not.toContain('confirmed tampering');
      expect(a.disclaimer.toLowerCase()).not.toContain('confirmed defect');

      // Feature breakdown must mark all standard features as unavailable
      expect(a.features).toBeInstanceOf(Array);
      expect(a.features.length).toBeGreaterThan(0);

      // Complaints and repairs must be explicitly marked unavailable (not fabricated)
      const complaintsFeature = a.features.find((f: any) => f.name === 'complaints');
      expect(complaintsFeature).toBeDefined();
      expect(complaintsFeature.available).toBe(false);
      expect(complaintsFeature.value).toBeNull();

      const repairsFeature = a.features.find((f: any) => f.name === 'repairs');
      expect(repairsFeature).toBeDefined();
      expect(repairsFeature.available).toBe(false);
      expect(repairsFeature.value).toBeNull();

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
    });

    it('returns 404 for non-existent instrument (404)', async () => {
      const res = await request(app)
        .post('/api/anomaly/instruments/WM-NONEXISTENT-99999/analyze')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });

  // ===========================================================================
  // 3. Instrument with finalized inspections → real analysis
  // ===========================================================================
  describe('3. Anomaly Analysis With Inspection History', () => {
    let assessment1Id: string;
    let assessment2Id: string;

    it('INSPECTOR analyzes instrument 1 (compliant history) — produces a valid assessment (201)', async () => {
      const res = await request(app)
        .post(`/api/anomaly/instruments/${instrument1Id}/analyze`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      const a = res.body.data.assessment;

      // Structural checks
      expect(a.assessmentId).toMatch(/^ANO-\d{4}-\d{5}$/);
      expect(a.instrumentIdSnapshot).toBe(instrument1Id);

      // Status must be NORMAL, POTENTIAL_ANOMALY, or INSUFFICIENT_DATA (never a free-form string)
      expect(['NORMAL', 'POTENTIAL_ANOMALY', 'INSUFFICIENT_DATA']).toContain(a.status);
      // Method must be labeled
      expect(['ISOLATION_FOREST', 'DETERMINISTIC_STATISTICAL_FALLBACK', 'INSUFFICIENT_DATA']).toContain(a.method);

      // Disclaimer checks
      expect(a.disclaimer).toMatch(/decision support only/i);
      expect(a.disclaimer.toLowerCase()).not.toContain('confirmed fraud');

      // Score is null only for INSUFFICIENT_DATA, otherwise a number in [0,1]
      if (a.status !== 'INSUFFICIENT_DATA') {
        expect(typeof a.anomalyScore).toBe('number');
        expect(a.anomalyScore).toBeGreaterThanOrEqual(0);
        expect(a.anomalyScore).toBeLessThanOrEqual(1);
      }

      // Feature breakdown must be present
      expect(a.features).toBeInstanceOf(Array);
      expect(a.features.length).toBeGreaterThan(0);

      // Complaints and repairs must be marked unavailable (not fabricated)
      const complaints = a.features.find((f: any) => f.name === 'complaints');
      expect(complaints?.available).toBe(false);
      expect(complaints?.value).toBeNull();

      const repairs = a.features.find((f: any) => f.name === 'repairs');
      expect(repairs?.available).toBe(false);
      expect(repairs?.value).toBeNull();

      // Inspection features must be available since history exists
      const passFailFeature = a.features.find((f: any) => f.name === 'passFailIndicator');
      expect(passFailFeature?.available).toBe(true);

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      assessment1Id = a.assessmentId;
    });

    it('ADMIN analyzes instrument 2 (FAIL history, high deviation) — assessment is persisted (201)', async () => {
      const res = await request(app)
        .post(`/api/anomaly/instruments/${instrument2Id}/analyze`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      const a = res.body.data.assessment;

      expect(a.assessmentId).toMatch(/^ANO-\d{4}-\d{5}$/);
      expect(a.instrumentIdSnapshot).toBe(instrument2Id);
      expect(['NORMAL', 'POTENTIAL_ANOMALY', 'INSUFFICIENT_DATA']).toContain(a.status);

      // passFailIndicator must reflect FAIL (1.0)
      const passFailFeature = a.features.find((f: any) => f.name === 'passFailIndicator');
      expect(passFailFeature?.available).toBe(true);
      expect(passFailFeature?.value).toBe(1.0);

      // priorFailureRate must reflect 100% failure
      const priorFailRate = a.features.find((f: any) => f.name === 'priorFailureRate');
      expect(priorFailRate?.available).toBe(true);
      expect(priorFailRate?.value).toBe(1.0);

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      assessment2Id = a.assessmentId;
    });

    it('assessments are immutable records — re-analyzing creates a new record, does not overwrite the previous', async () => {
      const initialCount = await AnomalyAssessment.countDocuments({ instrument: instrument1MongoId });

      const res = await request(app)
        .post(`/api/anomaly/instruments/${instrument1Id}/analyze`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      createdAssessmentIds.push(new mongoose.Types.ObjectId(res.body.data.assessment._id));

      const newCount = await AnomalyAssessment.countDocuments({ instrument: instrument1MongoId });
      expect(newCount).toBe(initialCount + 1);
    });

    it('confirms statutory PASS/FAIL result is never altered by anomaly analysis', async () => {
      // Instrument 1 inspections must still be PASS/FINALIZED
      const inspections1 = await Inspection.find({ instrument: instrument1MongoId });
      for (const insp of inspections1) {
        expect(insp.inspectorResult).toBe('PASS');
        expect(insp.status).toBe('FINALIZED');
      }

      // Instrument 2 inspection must still be FAIL/FINALIZED
      const insp2 = await Inspection.findOne({ instrument: instrument2MongoId });
      expect(insp2!.inspectorResult).toBe('FAIL');
      expect(insp2!.status).toBe('FINALIZED');
    });
  });

  // ===========================================================================
  // 4. Get latest assessment and role-scoped access
  // ===========================================================================
  describe('4. Role-Scoped Latest Assessment Retrieval', () => {
    it('OWNER 1 can view latest anomaly assessment of their own instrument (200)', async () => {
      const res = await request(app)
        .get(`/api/anomaly/instruments/${instrument1Id}/latest`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.assessment.instrumentIdSnapshot).toBe(instrument1Id);
    });

    it('OWNER 1 CANNOT view latest assessment of Instrument 2 (owned by Owner 2) — 404 scoped (404)', async () => {
      const res = await request(app)
        .get(`/api/anomaly/instruments/${instrument2Id}/latest`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(404);
    });

    it('INSPECTOR and ADMIN can view latest assessment for any instrument (200)', async () => {
      const resInsp = await request(app)
        .get(`/api/anomaly/instruments/${instrument1Id}/latest`)
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(resInsp.status).toBe(200);

      const resAdmin = await request(app)
        .get(`/api/anomaly/instruments/${instrument2Id}/latest`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });

    it('returns 404 if instrument has never been analyzed (404)', async () => {
      // Use a new instrument with no assessments
      const ts2 = Date.now() + 1;
      const freshInst = new Instrument({
        instrumentId: `WM-CHE-6BFRESH-${ts2}`,
        owner: (await User.findOne({ role: 'OWNER' }))!._id,
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Test',
        model: 'Test',
        serialNumber: `SN-FRESH-${ts2}`,
        capacity: { value: 5, unit: 'kg' },
        location: {
          address: '1 Test St',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
          coordinates: { type: 'Point', coordinates: [80.25, 13.06] }
        },
        status: 'REGISTERED',
        createdBy: (await User.findOne({ role: 'OWNER' }))!._id,
        updatedBy: (await User.findOne({ role: 'OWNER' }))!._id
      });
      await freshInst.save();
      createdInstrumentIds.push(freshInst._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .get(`/api/anomaly/instruments/${freshInst.instrumentId}/latest`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });
  });

  // ===========================================================================
  // 5. Potential anomalies list
  // ===========================================================================
  describe('5. Potential Anomalies List', () => {
    it('INSPECTOR can retrieve potential-anomalies list (200)', async () => {
      const res = await request(app)
        .get('/api/anomaly/potential-anomalies')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.potentialAnomalies).toBeInstanceOf(Array);

      // All items in the list must have potentialAnomaly === true
      for (const item of res.body.data.potentialAnomalies) {
        expect(item.potentialAnomaly).toBe(true);
      }
    });

    it('ADMIN can retrieve potential-anomalies list (200)', async () => {
      const res = await request(app)
        .get('/api/anomaly/potential-anomalies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.potentialAnomalies).toBeInstanceOf(Array);
    });

    it('potential-anomalies list does not contain entries with potentialAnomaly === false', async () => {
      const res = await request(app)
        .get('/api/anomaly/potential-anomalies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.data.potentialAnomalies) {
        expect(item.potentialAnomaly).toBe(true);
      }
    });
  });

  // ===========================================================================
  // 6. Batch analysis
  // ===========================================================================
  describe('6. Batch Analysis', () => {
    it('INSPECTOR triggers batch analysis and receives structured response (201)', async () => {
      const res = await request(app)
        .post('/api/anomaly/batch')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.totalAnalyzed).toBeGreaterThanOrEqual(0);
      expect(res.body.data.assessments).toBeInstanceOf(Array);

      for (const a of res.body.data.assessments) {
        expect(a.assessmentId).toMatch(/^ANO-\d{4}-\d{5}$/);
        expect(['NORMAL', 'POTENTIAL_ANOMALY', 'INSUFFICIENT_DATA']).toContain(a.status);
        // Store for cleanup
        createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      }
    });

    it('ADMIN triggers batch analysis (201)', async () => {
      const res = await request(app)
        .post('/api/anomaly/batch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      for (const a of res.body.data.assessments) {
        createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      }
    });
  });

  // ===========================================================================
  // 7. Feature transparency — no fabrication of complaints/repairs/regional
  // ===========================================================================
  describe('7. Feature Transparency and No Fabrication', () => {
    it('every assessment feature breakdown marks complaints as unavailable and null', async () => {
      const assessments = await AnomalyAssessment.find({
        instrument: { $in: [instrument1MongoId, instrument2MongoId, instrumentNoDataMongoId] }
      });

      expect(assessments.length).toBeGreaterThan(0);

      for (const a of assessments) {
        const complaintsFeature = a.features.find((f) => f.name === 'complaints');
        expect(complaintsFeature).toBeDefined();
        expect(complaintsFeature!.available).toBe(false);
        expect(complaintsFeature!.value).toBeNull();

        const repairsFeature = a.features.find((f) => f.name === 'repairs');
        expect(repairsFeature).toBeDefined();
        expect(repairsFeature!.available).toBe(false);
        expect(repairsFeature!.value).toBeNull();
      }
    });

    it('contributing factors never contain defamatory language such as fraud or tamper', async () => {
      const assessments = await AnomalyAssessment.find({});
      for (const a of assessments) {
        for (const factor of a.contributingFactors) {
          expect(factor.toLowerCase()).not.toContain('fraud');
          expect(factor.toLowerCase()).not.toContain('tamper');
          expect(factor.toLowerCase()).not.toContain('defect');
        }
      }
    });

    it('disclaimer is present and contains the mandatory decision-support language on every saved assessment', async () => {
      const assessments = await AnomalyAssessment.find({
        instrument: { $in: [instrument1MongoId, instrument2MongoId] }
      });
      for (const a of assessments) {
        expect(a.disclaimer).toMatch(/decision support only/i);
        expect(a.disclaimer).toMatch(/does not.*confirm fraud/i);
        expect(a.disclaimer).toMatch(/PASS\/FAIL/i);
      }
    });
  });
});
