import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { Inspection } from '../src/models/inspection.model';
import { PhotoAssistAssessment } from '../src/models/photo-assist.model';
import { PredictiveAssessment } from '../src/models/predictive-assessment.model';
import { VerificationMethodRule } from '../src/models/verification-rule.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`
    );
  }
};

describe('SmartMetrix Phase 7 Lite — Advanced Decision Support', () => {
  let adminToken: string;
  let inspectorToken: string;
  let ownerToken: string;

  let ownerUser: any;
  let adminUser: any;
  let testInstrument: any;
  let testInstrument2: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assertTestDatabaseSafety();

    // Cleanup
    await User.deleteMany({ email: { $regex: /@phase7\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P7/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INSP-P7-/ } });
    await PhotoAssistAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });
    await PredictiveAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });
    await VerificationMethodRule.deleteMany({ name: { $regex: /Phase 7/ } });

    // Seed Users
    adminUser = await User.create({
      name: 'P7 Admin',
      email: 'admin@phase7.smartmetrix.test',
      password: 'password123',
      role: 'ADMIN'
    });

    const inspectorUser = await User.create({
      name: 'P7 Inspector',
      email: 'inspector@phase7.smartmetrix.test',
      password: 'password123',
      role: 'INSPECTOR'
    });

    ownerUser = await User.create({
      name: 'P7 Owner',
      email: 'owner@phase7.smartmetrix.test',
      password: 'password123',
      role: 'OWNER'
    });

    // Tokens
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@phase7.smartmetrix.test', password: 'password123' });
    adminToken = adminRes.body.data ? adminRes.body.data.token : '';

    const inspRes = await request(app).post('/api/auth/login').send({ email: 'inspector@phase7.smartmetrix.test', password: 'password123' });
    inspectorToken = inspRes.body.data ? inspRes.body.data.token : '';

    const ownRes = await request(app).post('/api/auth/login').send({ email: 'owner@phase7.smartmetrix.test', password: 'password123' });
    ownerToken = ownRes.body.data ? ownRes.body.data.token : '';

    // Seed Instruments
    testInstrument = await Instrument.create({
      instrumentId: 'INST-P7-001',
      owner: ownerUser._id,
      type: 'PRECISION_BALANCE',
      category: 'ANALYTICAL',
      manufacturer: 'SHIMADZU',
      model: 'AUW-220D',
      serialNumber: 'SN-P7-001',
      capacity: { value: 220, unit: 'g' },
      location: {
        address: 'Tech Park',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pincode: '560001',
        coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });

    testInstrument2 = await Instrument.create({
      instrumentId: 'INST-P7-002',
      owner: ownerUser._id,
      type: 'PRECISION_BALANCE',
      category: 'ANALYTICAL',
      manufacturer: 'SHIMADZU',
      model: 'AUW-220D',
      serialNumber: 'SN-P7-002',
      capacity: { value: 220, unit: 'g' },
      location: {
        address: 'Indiranagar',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pincode: '560038',
        coordinates: { type: 'Point', coordinates: [77.6412, 12.9784] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });

    // Seed 2 finalized inspections for testInstrument for predictive analysis
    await Inspection.create({
      inspectionId: 'INSP-P7-001',
      instrument: testInstrument._id,
      instrumentIdSnapshot: 'INST-P7-001',
      verificationRequest: new mongoose.Types.ObjectId(),
      inspector: inspectorUser._id,
      inspectionDate: new Date('2026-01-01'),
      status: 'FINALIZED',
      referenceReading: 100,
      actualReading: 100.05,
      deviation: 0.05,
      deviationPercentage: 0.05,
      serialNumberMatch: true,
      toleranceSnapshot: {
        ruleId: 'TR-001',
        name: 'Test Rule',
        toleranceMode: 'ABSOLUTE',
        toleranceValue: 0.5,
        capacityUnit: 'g'
      },
      calculatedAssessment: 'WITHIN_TOLERANCE',
      inspectorResult: 'PASS',
      comments: 'Phase 7 Initial Inspection',
      finalizedAt: new Date('2026-01-01')
    });

    await Inspection.create({
      inspectionId: 'INSP-P7-002',
      instrument: testInstrument._id,
      instrumentIdSnapshot: 'INST-P7-001',
      verificationRequest: new mongoose.Types.ObjectId(),
      inspector: inspectorUser._id,
      inspectionDate: new Date('2026-02-01'),
      status: 'FINALIZED',
      referenceReading: 100,
      actualReading: 100.25,
      deviation: 0.25,
      deviationPercentage: 0.25,
      serialNumberMatch: true,
      toleranceSnapshot: {
        ruleId: 'TR-001',
        name: 'Test Rule',
        toleranceMode: 'ABSOLUTE',
        toleranceValue: 0.5,
        capacityUnit: 'g'
      },
      calculatedAssessment: 'WITHIN_TOLERANCE',
      inspectorResult: 'PASS',
      comments: 'Phase 7 Followup Inspection',
      finalizedAt: new Date('2026-02-01')
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    await User.deleteMany({ email: { $regex: /@phase7\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P7/ } });
    await Inspection.deleteMany({ comments: { $regex: /Phase 7/ } });
    await PhotoAssistAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });
    await PredictiveAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });
    await VerificationMethodRule.deleteMany({ name: { $regex: /Phase 7/ } });
  });

  it('1. ADMIN can create and soft-deactivate a VerificationMethodRule', async () => {
    const res = await request(app)
      .post('/api/phase7/admin/verification-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 7 Standard Analytical Rule',
        instrumentType: 'PRECISION_BALANCE',
        instrumentCategory: 'ANALYTICAL',
        verificationMethod: 'E2_STANDARD_WEIGHT_COMPARISON',
        requiredEquipment: ['E2_MASS_SET', 'THERMO_HYGROMETER'],
        estimatedEffortHours: 3,
        authorizedFacilityProfiles: [
          {
            facilityId: 'FAC-BLR-01',
            name: 'Central Metrology Lab Bengaluru',
            location: {
              city: 'Bengaluru',
              state: 'Karnataka',
              coordinates: { type: 'Point', coordinates: [77.5900, 12.9700] }
            },
            availableEquipment: ['E2_MASS_SET', 'THERMO_HYGROMETER'],
            maxDailyCapacity: 5
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    const rule = res.body.data.rule;
    expect(rule.ruleId).toMatch(/^VRR-/);
    expect(rule.isActive).toBe(true);

    // Soft-deactivate rule
    const deactRes = await request(app)
      .post(`/api/phase7/admin/verification-rules/${rule.ruleId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.rule.isActive).toBe(false);
  });

  it('2. Predictive analysis returns INSUFFICIENT_DATA when history < 2', async () => {
    const res = await request(app)
      .post('/api/phase7/predictive/instruments/INST-P7-002/analyze')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.assessment.status).toBe('INSUFFICIENT_DATA');
    expect(res.body.data.assessment.trendDirection).toBe('INSUFFICIENT_DATA');
  });

  it('3. Predictive analysis calculates trend direction when history >= 2', async () => {
    const res = await request(app)
      .post('/api/phase7/predictive/instruments/INST-P7-001/analyze')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    const ass = res.body.data.assessment;
    expect(ass.status).toBe('SUCCESS');
    expect(ass.trendDirection).toMatch(/WORSENING|STABLE|IMPROVING/);
    expect(ass.disclaimer).toContain('NEVER call it legal failure prediction');
  });

  it('4. Planning Twin endpoint returns structured representation', async () => {
    const res = await request(app)
      .get('/api/phase7/planning/twin/INST-P7-001')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const twin = res.body.data.twin;
    expect(twin.instrumentId).toBe('INST-P7-001');
    expect(twin.inspectionHistorySummary.totalFinalized).toBe(2);
    expect(twin.disclaimer).toContain('Planning Twin representation for decision support only');
  });

  it('5. Burden Optimization returns ranked plans or INSUFFICIENT_CONFIGURATION', async () => {
    // Create rule first
    await request(app)
      .post('/api/phase7/admin/verification-rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase 7 Active Rule',
        instrumentType: 'PRECISION_BALANCE',
        instrumentCategory: 'ANALYTICAL',
        verificationMethod: 'E2_WEIGHT_COMPARISON',
        requiredEquipment: ['E2_MASS_SET'],
        estimatedEffortHours: 2,
        authorizedFacilityProfiles: [
          {
            facilityId: 'FAC-BLR-MAIN',
            name: 'Main Lab',
            location: {
              city: 'Bengaluru',
              state: 'Karnataka',
              coordinates: { type: 'Point', coordinates: [77.5950, 12.9720] }
            },
            availableEquipment: ['E2_MASS_SET'],
            maxDailyCapacity: 10
          }
        ]
      });

    const res = await request(app)
      .post('/api/phase7/planning/burden-optimize')
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ instrumentId: 'INST-P7-001' });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.status).toBe('SUCCESS');
    expect(Array.isArray(data.recommendedPlans)).toBe(true);
    expect(data.recommendedPlans.length).toBeGreaterThanOrEqual(1);
    expect(data.recommendedPlans[0].rank).toBe(1);
  });

  it('6. Geo-Scheduling Recommendation returns ranked candidates without mutating schedules', async () => {
    const res = await request(app)
      .post('/api/phase7/planning/geo-schedule-recommend')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        instrumentId: 'INST-P7-001',
        inspectorLocations: [
          { inspectorId: 'INSP-1', name: 'Nearby Inspector', coordinates: [77.5950, 12.9720], activeSchedulesCount: 1 },
          { inspectorId: 'INSP-2', name: 'Distant Inspector', coordinates: [77.7000, 13.1000], activeSchedulesCount: 4 }
        ]
      });

    expect(res.status).toBe(200);
    const recs = res.body.data.recommendations;
    expect(recs.length).toBe(2);
    expect(recs[0].rank).toBe(1);
    expect(recs[0].inspectorId).toBe('INSP-1'); // Nearby & less busy comes first
  });
});
