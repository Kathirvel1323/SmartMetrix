import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { ToleranceRule } from '../src/models/tolerance-rule.model';
import { Inspection } from '../src/models/inspection.model';
import { RiskConfiguration, IRiskWeights, IRiskThresholds } from '../src/models/risk-config.model';
import { RiskAssessment } from '../src/models/risk-assessment.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

// Track test record IDs for safe cleanup
const createdUserIds: mongoose.Types.ObjectId[] = [];
const createdInstrumentIds: mongoose.Types.ObjectId[] = [];
const createdVerificationIds: mongoose.Types.ObjectId[] = [];
const createdRuleIds: mongoose.Types.ObjectId[] = [];
const createdInspectionIds: mongoose.Types.ObjectId[] = [];
const createdConfigIds: mongoose.Types.ObjectId[] = [];
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

const DEFAULT_WEIGHTS: IRiskWeights = {
  deviation: 20,
  failedInspections: 15,
  complaints: 10,
  repairs: 10,
  overdueCertificate: 10,
  nonComplianceHistory: 10,
  age: 5,
  calibrationIssues: 5,
  regionalRisk: 15
};

const DEFAULT_THRESHOLDS: IRiskThresholds = {
  LOW: { min: 0, max: 25 },
  MEDIUM: { min: 25, max: 50 },
  HIGH: { min: 50, max: 75 },
  CRITICAL: { min: 75, max: 100 }
};

describe('Phase 6A Integration Tests: Explainable Risk Score and Trust Score', () => {
  let adminToken: string;
  let adminId: string;
  let inspectorToken: string;
  let inspectorId: string;
  let owner1Token: string;
  let owner1Id: string;
  let owner2Token: string;
  let owner2Id: string;

  let instrument1Id: string;
  let instrument1MongoId: mongoose.Types.ObjectId;
  let instrument2Id: string;
  let instrument2MongoId: mongoose.Types.ObjectId;
  let instrumentNoDataId: string;
  let instrumentNoDataMongoId: mongoose.Types.ObjectId;

  let toleranceRuleId: string;
  let activeConfigId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.JWT_EXPIRES_IN = '1h';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    assertTestDatabaseSafety();

    await RiskConfiguration.syncIndexes();
    await RiskAssessment.syncIndexes();
    await Inspection.syncIndexes();
    await Instrument.syncIndexes();
    await User.syncIndexes();

    const ts = Date.now();

    // 1. Seed Users
    const admin = new User({
      name: 'Admin Six',
      email: `admin6_${ts}@test.local`,
      password: 'AdminPassword123!',
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });
    await admin.save();
    createdUserIds.push(admin._id as mongoose.Types.ObjectId);
    adminId = admin._id.toString();

    const inspector = new User({
      name: 'Inspector Six',
      email: `inspector6_${ts}@test.local`,
      password: 'InspectorPassword123!',
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });
    await inspector.save();
    createdUserIds.push(inspector._id as mongoose.Types.ObjectId);
    inspectorId = inspector._id.toString();

    const owner1 = new User({
      name: 'Owner Six A',
      email: `owner6a_${ts}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner1.save();
    createdUserIds.push(owner1._id as mongoose.Types.ObjectId);
    owner1Id = owner1._id.toString();

    const owner2 = new User({
      name: 'Owner Six B',
      email: `owner6b_${ts}@test.local`,
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
      ruleId: `TOL-6A-${ts}`,
      name: 'Standard Weight Rule 6A',
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

    // 3. Seed Instrument 1 (Owner 1, has valid certificate, good inspection history)
    const inst1 = new Instrument({
      instrumentId: `WM-CHE-6A01-${ts}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Essae Metrology',
      model: 'DS-215',
      serialNumber: `SN-6A-1-${ts}`,
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
        certificateNumber: 'CERT-6A-VALID',
        issueDate: new Date(Date.now() - 30 * 86400000),
        expiryDate: new Date(Date.now() + 335 * 86400000), // Valid future expiry
        verifierId: inspector._id
      },
      createdBy: owner1._id,
      updatedBy: owner1._id
    });
    await inst1.save();
    createdInstrumentIds.push(inst1._id as mongoose.Types.ObjectId);
    instrument1Id = inst1.instrumentId;
    instrument1MongoId = inst1._id as mongoose.Types.ObjectId;

    // 4. Seed Instrument 2 (Owner 2, expired certificate, failed inspection history)
    const inst2 = new Instrument({
      instrumentId: `WM-CHE-6A02-${ts}`,
      owner: owner2._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Avery Weightronix',
      model: 'E-1010',
      serialNumber: `SN-6A-2-${ts}`,
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
      currentCertificate: {
        certificateNumber: 'CERT-6A-EXPIRED',
        issueDate: new Date(Date.now() - 400 * 86400000),
        expiryDate: new Date(Date.now() - 35 * 86400000), // Expired in past
        verifierId: inspector._id
      },
      createdBy: owner2._id,
      updatedBy: owner2._id
    });
    await inst2.save();
    createdInstrumentIds.push(inst2._id as mongoose.Types.ObjectId);
    instrument2Id = inst2.instrumentId;
    instrument2MongoId = inst2._id as mongoose.Types.ObjectId;

    // 5. Seed Instrument No Data (Owner 1, zero inspections, no certificate)
    const instNoData = new Instrument({
      instrumentId: `WM-CHE-6A03-${ts}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Citizen Scales',
      model: 'CZ-30',
      serialNumber: `SN-6A-3-${ts}`,
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

    // 6. Seed Finalized Inspections for Instrument 1 (2 PASS inspections, low deviation)
    for (let i = 1; i <= 2; i++) {
      const vrf = new VerificationRequest({
        requestId: `VRF-6A1-${i}-${ts}`,
        instrument: inst1._id,
        owner: owner1._id,
        verificationType: 'INITIAL',
        status: i === 2 ? 'PASSED' : 'CLOSED', // Terminal CLOSED for older history so partial index allows both
        createdBy: owner1._id,
        updatedBy: admin._id
      });
      await vrf.save();
      createdVerificationIds.push(vrf._id as mongoose.Types.ObjectId);

      const insp = new Inspection({
        inspectionId: `INS-6A1-${i}-${ts}`,
        status: 'FINALIZED',
        instrument: inst1._id,
        instrumentIdSnapshot: inst1.instrumentId,
        verificationRequest: vrf._id,
        inspector: inspector._id,
        inspectionDate: new Date(Date.now() - i * 10 * 86400000),
        referenceReading: 10,
        actualReading: 10.02, // 0.2% deviation (within 1% tolerance)
        deviation: 0.02,
        deviationPercentage: 0.2,
        toleranceSnapshot: {
          ruleId: toleranceRuleId,
          name: 'Standard Weight Rule 6A',
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

    // 7. Seed Finalized Inspection for Instrument 2 (1 FAIL inspection, high deviation OUTSIDE_TOLERANCE)
    const vrf2 = new VerificationRequest({
      requestId: `VRF-6A2-1-${ts}`,
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
      inspectionId: `INS-6A2-1-${ts}`,
      status: 'FINALIZED',
      instrument: inst2._id,
      instrumentIdSnapshot: inst2.instrumentId,
      verificationRequest: vrf2._id,
      inspector: inspector._id,
      inspectionDate: new Date(Date.now() - 5 * 86400000),
      referenceReading: 50,
      actualReading: 54, // 8% deviation (outside 1% tolerance)
      deviation: 4,
      deviationPercentage: 8.0,
      toleranceSnapshot: {
        ruleId: toleranceRuleId,
        name: 'Standard Weight Rule 6A',
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
      await RiskAssessment.deleteMany({ _id: { $in: createdAssessmentIds } });
    }
    if (createdConfigIds.length > 0) {
      await RiskConfiguration.deleteMany({ _id: { $in: createdConfigIds } });
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
  // 1. Configuration Management & Validation Tests
  // ===========================================================================
  describe('1. Risk Configuration: Weights & Thresholds Validation', () => {
    it('rejects configuration creation if weights do not sum to 100 (400)', async () => {
      const invalidWeights = { ...DEFAULT_WEIGHTS, deviation: 30 }; // Sum = 110
      const res = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Weights Sum',
          weights: invalidWeights,
          thresholds: DEFAULT_THRESHOLDS
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/weights must sum exactly to 100/i);
    });

    it('rejects configuration creation if a required factor weight is missing (400)', async () => {
      const missingKeyWeights: any = { ...DEFAULT_WEIGHTS };
      delete missingKeyWeights.regionalRisk;

      const res = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Key Weight',
          weights: missingKeyWeights,
          thresholds: DEFAULT_THRESHOLDS
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/missing weight for factor 'regionalRisk'/i);
    });

    it('rejects configuration creation with negative weight values (400)', async () => {
      const negativeWeights = { ...DEFAULT_WEIGHTS, deviation: -10, failedInspections: 45 };
      const res = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Weight',
          weights: negativeWeights,
          thresholds: DEFAULT_THRESHOLDS
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('rejects configuration creation if thresholds are not contiguous or increasing (400)', async () => {
      const invalidThresholds: IRiskThresholds = {
        LOW: { min: 0, max: 50 },
        MEDIUM: { min: 40, max: 70 }, // Overlaps with LOW!
        HIGH: { min: 70, max: 85 },
        CRITICAL: { min: 85, max: 100 }
      };

      const res = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Thresholds',
          weights: DEFAULT_WEIGHTS,
          thresholds: invalidThresholds
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/contiguous/i);
    });

    it('forbids OWNER or INSPECTOR from creating risk configurations (403)', async () => {
      const resOwner = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ name: 'Owner Config', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS });
      expect(resOwner.status).toBe(403);

      const resInsp = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ name: 'Inspector Config', weights: DEFAULT_WEIGHTS, thresholds: DEFAULT_THRESHOLDS });
      expect(resInsp.status).toBe(403);
    });

    it('ADMIN creates a valid RiskConfiguration (201, initially inactive)', async () => {
      const res = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Baseline Legal Metrology Risk Config v1',
          weights: DEFAULT_WEIGHTS,
          thresholds: DEFAULT_THRESHOLDS,
          missingDataStrategy: 'RENORMALIZE'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.configuration).toBeDefined();

      const cfg = res.body.data.configuration;
      expect(cfg.configId).toMatch(/^RSK-\d{4}-\d{5}$/);
      expect(cfg.name).toBe('Baseline Legal Metrology Risk Config v1');
      expect(cfg.isActive).toBe(false);
      expect(cfg.version).toBe(1);
      expect(cfg.missingDataStrategy).toBe('RENORMALIZE');

      createdConfigIds.push(new mongoose.Types.ObjectId(cfg._id));
      activeConfigId = cfg.configId;
    });
  });

  // ===========================================================================
  // 2. Activation & Single Active Configuration Enforcement
  // ===========================================================================
  describe('2. Risk Configuration Activation & Single Active Enforcement', () => {
    it('returns 404 when getting active configuration before any is activated', async () => {
      const res = await request(app)
        .get('/api/risk/configurations/active')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    it('ADMIN activates the risk configuration (200)', async () => {
      const res = await request(app)
        .patch(`/api/risk/configurations/${activeConfigId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.configuration.isActive).toBe(true);
    });

    it('returns 409 if trying to activate an already active configuration', async () => {
      const res = await request(app)
        .patch(`/api/risk/configurations/${activeConfigId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toMatch(/already active/i);
    });

    it('ADMIN creates a second configuration and activates it; deactivates the previous one atomically', async () => {
      const res2 = await request(app)
        .post('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Alternative Risk Config v2',
          weights: {
            ...DEFAULT_WEIGHTS,
            deviation: 30,
            failedInspections: 25,
            complaints: 5,
            repairs: 5,
            overdueCertificate: 5,
            nonComplianceHistory: 5,
            age: 5,
            calibrationIssues: 5,
            regionalRisk: 15
          },
          thresholds: DEFAULT_THRESHOLDS,
          missingDataStrategy: 'RENORMALIZE'
        });
      expect(res2.status).toBe(201);
      const cfg2 = res2.body.data.configuration;
      createdConfigIds.push(new mongoose.Types.ObjectId(cfg2._id));

      // Activate config 2
      const actRes = await request(app)
        .patch(`/api/risk/configurations/${cfg2.configId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(actRes.status).toBe(200);
      expect(actRes.body.data.configuration.isActive).toBe(true);

      // Verify exactly ONE configuration in the entire database has isActive === true
      const activeConfigs = await RiskConfiguration.find({ isActive: true });
      expect(activeConfigs.length).toBe(1);
      expect(activeConfigs[0].configId).toBe(cfg2.configId);

      // Re-activate config 1 for subsequent tests
      const reActRes = await request(app)
        .patch(`/api/risk/configurations/${activeConfigId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reActRes.status).toBe(200);

      const activeConfigsFinal = await RiskConfiguration.find({ isActive: true });
      expect(activeConfigsFinal.length).toBe(1);
      expect(activeConfigsFinal[0].configId).toBe(activeConfigId);
    });

    it('GET /api/risk/configurations lists all configs for ADMIN (200)', async () => {
      const res = await request(app)
        .get('/api/risk/configurations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.configurations).toBeInstanceOf(Array);
      expect(res.body.data.configurations.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/risk/configurations/active accessible by INSPECTOR (200)', async () => {
      const res = await request(app)
        .get('/api/risk/configurations/active')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.configuration.configId).toBe(activeConfigId);
      expect(res.body.data.configuration.isActive).toBe(true);
    });
  });

  // ===========================================================================
  // 3. Explainable Risk and Trust Score Assessment
  // ===========================================================================
  describe('3. Risk and Trust Score Assessment Engine', () => {
    let assessment1Id: string;
    let assessment2Id: string;

    it('INSPECTOR assesses Instrument 1 (compliant history, valid cert) (201)', async () => {
      const res = await request(app)
        .post(`/api/risk/instruments/${instrument1Id}/assess`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.assessment).toBeDefined();

      const a = res.body.data.assessment;
      expect(a.assessmentId).toMatch(/^RAS-\d{4}-\d{5}$/);
      expect(a.instrumentIdSnapshot).toBe(instrument1Id);

      // Disclaimer requirement: affirms decision support only and disclaims fraud/tampering
      expect(a.disclaimer).toMatch(/decision support only/i);
      expect(a.disclaimer).toMatch(/does not.*confirm fraud/i);

      // Score ranges & types
      expect(typeof a.riskScore).toBe('number');
      expect(a.riskScore).toBeGreaterThanOrEqual(0);
      expect(a.riskScore).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(a.riskLevel);

      // Recommended action
      expect(a.recommendedAction).toBeDefined();
      expect(typeof a.recommendedAction).toBe('string');

      // Transparent missing factors
      expect(a.missingFactors).toContain('complaints');
      expect(a.missingFactors).toContain('repairs');
      expect(a.missingFactors).toContain('calibrationIssues');
      expect(a.missingFactors).toContain('regionalRisk');
      expect(a.missingFactors).toContain('age');

      // Risk factors breakdown reconciliation
      expect(a.riskFactors).toHaveLength(9);
      let calculatedSum = 0;
      for (const rf of a.riskFactors) {
        expect(rf.factor).toBeDefined();
        if (['complaints', 'repairs', 'calibrationIssues', 'regionalRisk', 'age'].includes(rf.factor)) {
          expect(rf.available).toBe(false);
          expect(rf.rawValue).toBeNull();
          expect(rf.contribution).toBe(0);
        } else {
          expect(rf.available).toBe(true);
        }
        calculatedSum += rf.contribution;
      }
      // Reconciles within decimal precision
      expect(Math.abs(calculatedSum - a.riskScore)).toBeLessThan(0.05);

      // Trust score checks
      expect(typeof a.trustScore).toBe('number');
      expect(a.trustScore).toBeGreaterThanOrEqual(0);
      expect(a.trustScore).toBeLessThanOrEqual(100);
      expect(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).toContain(a.trustLevel);
      expect(a.trustFactors).toBeInstanceOf(Array);
      expect(a.trustExplanation).toBeDefined();

      // Instrument 1 had 100% pass rate and valid cert => High trust
      expect(a.trustScore).toBeGreaterThan(60);

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      assessment1Id = a.assessmentId;
    });

    it('ADMIN assesses Instrument 2 (failed history, expired cert, high deviation) (201)', async () => {
      const res = await request(app)
        .post(`/api/risk/instruments/${instrument2Id}/assess`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      const a = res.body.data.assessment;

      // Failed history and expired cert must result in a higher risk score than Instrument 1
      const a1 = await RiskAssessment.findOne({ assessmentId: assessment1Id });
      expect(a.riskScore).toBeGreaterThan(a1!.riskScore);

      // Instrument 2 trust score should be lower than Instrument 1
      expect(a.trustScore).toBeLessThan(a1!.trustScore);

      // Check overdueCertificate factor in risk breakdown
      const certFactor = a.riskFactors.find((f: any) => f.factor === 'overdueCertificate');
      expect(certFactor).toBeDefined();
      expect(certFactor.available).toBe(true);
      expect(certFactor.rawValue).toBe(1); // 1 = expired
      expect(certFactor.contribution).toBeGreaterThan(0);

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
      assessment2Id = a.assessmentId;
    });

    it('assesses Instrument with NO inspection history or certificate: does not crash or fabricate data', async () => {
      const res = await request(app)
        .post(`/api/risk/instruments/${instrumentNoDataId}/assess`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      const a = res.body.data.assessment;

      // Data coverage should be 0 because no factors are available
      expect(a.dataCoverage).toBe(0);
      expect(a.riskScore).toBe(0); // 0 contributions
      expect(a.riskLevel).toBe('LOW');

      // Trust level should be UNKNOWN when no history exists
      expect(a.trustLevel).toBe('UNKNOWN');
      expect(a.trustScore).toBe(0);
      expect(a.trustExplanation).toMatch(/no finalized inspection history exists/i);

      createdAssessmentIds.push(new mongoose.Types.ObjectId(a._id));
    });

    it('returns 404 if instrument does not exist', async () => {
      const res = await request(app)
        .post('/api/risk/instruments/WM-NONEXISTENT-99999/assess')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('error');
    });

    it('forbids OWNER from triggering risk assessment (403)', async () => {
      const res = await request(app)
        .post(`/api/risk/instruments/${instrument1Id}/assess`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });
  });

  // ===========================================================================
  // 4. Role-Scoped Retrieval: Latest, History, and Priorities
  // ===========================================================================
  describe('4. Role-Scoped Retrieval: Latest, History & Priority Ranking', () => {
    it('OWNER 1 can view latest assessment of their OWN instrument (200)', async () => {
      const res = await request(app)
        .get(`/api/risk/instruments/${instrument1Id}/latest`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.assessment.instrumentIdSnapshot).toBe(instrument1Id);
    });

    it('OWNER 1 CANNOT view latest assessment of Instrument 2 (owned by OWNER 2) (404 scoped)', async () => {
      const res = await request(app)
        .get(`/api/risk/instruments/${instrument2Id}/latest`)
        .set('Authorization', `Bearer ${owner1Token}`);

      // Returns 404 for scoped privacy
      expect(res.status).toBe(404);
    });

    it('INSPECTOR and ADMIN can view latest assessment of any instrument (200)', async () => {
      const resInsp = await request(app)
        .get(`/api/risk/instruments/${instrument1Id}/latest`)
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(resInsp.status).toBe(200);

      const resAdmin = await request(app)
        .get(`/api/risk/instruments/${instrument2Id}/latest`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
    });

    it('re-assessing instrument creates a NEW immutable history record without overwriting previous (201)', async () => {
      const initialCount = await RiskAssessment.countDocuments({ instrument: instrument1MongoId });

      const res = await request(app)
        .post(`/api/risk/instruments/${instrument1Id}/assess`)
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(201);
      createdAssessmentIds.push(new mongoose.Types.ObjectId(res.body.data.assessment._id));

      const newCount = await RiskAssessment.countDocuments({ instrument: instrument1MongoId });
      expect(newCount).toBe(initialCount + 1);

      // Verify history endpoint returns both assessments sorted desc by date
      const histRes = await request(app)
        .get(`/api/risk/instruments/${instrument1Id}/history`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(histRes.status).toBe(200);
      expect(histRes.body.data).toBeInstanceOf(Array);
      expect(histRes.body.data.length).toBe(2);
      expect(histRes.body.pagination).toBeDefined();
      expect(histRes.body.pagination.total).toBe(2);
    });

    it('OWNER 1 CANNOT view assessment history of Instrument 2 (404 scoped)', async () => {
      const res = await request(app)
        .get(`/api/risk/instruments/${instrument2Id}/history`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(404);
    });

    it('INSPECTOR and ADMIN can retrieve priority list ordered by latest riskScore desc (200)', async () => {
      const res = await request(app)
        .get('/api/risk/priorities')
        .set('Authorization', `Bearer ${inspectorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.priorities).toBeInstanceOf(Array);

      const list = res.body.data.priorities;
      expect(list.length).toBeGreaterThanOrEqual(2);

      // Verify descending sort order by riskScore
      for (let i = 0; i < list.length - 1; i++) {
        expect(list[i].riskScore).toBeGreaterThanOrEqual(list[i + 1].riskScore);
      }

      // Instrument 2 (higher risk) must appear before Instrument 1 (lower risk)
      const index2 = list.findIndex((item: any) => item.instrumentIdSnapshot === instrument2Id);
      const index1 = list.findIndex((item: any) => item.instrumentIdSnapshot === instrument1Id);
      expect(index2).toBeLessThan(index1);
    });

    it('forbids OWNER from accessing priorities list (403)', async () => {
      const res = await request(app)
        .get('/api/risk/priorities')
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(403);
    });

    it('confirms risk scores are decision support only: statutory PASS/FAIL is untouched', async () => {
      // Finalized inspections must still maintain their original inspectorResult
      const inspections = await Inspection.find({ instrument: instrument1MongoId });
      for (const insp of inspections) {
        expect(insp.inspectorResult).toBe('PASS');
        expect(insp.status).toBe('FINALIZED');
      }

      const insp2 = await Inspection.findOne({ instrument: instrument2MongoId });
      expect(insp2!.inspectorResult).toBe('FAIL');
      expect(insp2!.status).toBe('FINALIZED');
    });
  });
});
