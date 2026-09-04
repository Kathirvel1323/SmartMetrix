import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { Inspection } from '../src/models/inspection.model';
import { RegionalConfig } from '../src/models/regional-config.model';
import { RegionalCorrelationAssessment } from '../src/models/regional-correlation.model';
import { calculateHaversineDistance, calculateInstrumentSimilarity } from '../src/utils/regional-calculator.utils';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`
    );
  }
};

describe('SmartMetrix Phase 6C — Regional Correlation & Intelligence', () => {
  let adminToken: string;
  let inspectorToken: string;
  let ownerToken: string;
  let owner2Token: string;

  let ownerUser: any;
  let owner2User: any;
  let adminUser: any;

  let targetInstrument: any;
  let nearbyInstrument: any;
  let farInstrument: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assertTestDatabaseSafety();

    // Clean up test data
    await User.deleteMany({ email: { $regex: /@phase6c\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-6C/ } });
    await Inspection.deleteMany({ comments: { $regex: /Phase 6C/ } });
    await RegionalConfig.deleteMany({ name: { $regex: /Phase 6C/ } });
    await RegionalCorrelationAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });

    // Seed Users
    adminUser = await User.create({
      name: 'P6C Admin',
      email: 'admin@phase6c.smartmetrix.test',
      password: 'password123',
      role: 'ADMIN'
    });

    const inspectorUser = await User.create({
      name: 'P6C Inspector',
      email: 'inspector@phase6c.smartmetrix.test',
      password: 'password123',
      role: 'INSPECTOR'
    });

    ownerUser = await User.create({
      name: 'P6C Owner 1',
      email: 'owner1@phase6c.smartmetrix.test',
      password: 'password123',
      role: 'OWNER'
    });

    owner2User = await User.create({
      name: 'P6C Owner 2',
      email: 'owner2@phase6c.smartmetrix.test',
      password: 'password123',
      role: 'OWNER'
    });

    // Login tokens
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@phase6c.smartmetrix.test',
      password: 'password123'
    });
    adminToken = adminRes.body.data ? adminRes.body.data.token : '';

    const inspRes = await request(app).post('/api/auth/login').send({
      email: 'inspector@phase6c.smartmetrix.test',
      password: 'password123'
    });
    inspectorToken = inspRes.body.data ? inspRes.body.data.token : '';

    const ownRes = await request(app).post('/api/auth/login').send({
      email: 'owner1@phase6c.smartmetrix.test',
      password: 'password123'
    });
    ownerToken = ownRes.body.data ? ownRes.body.data.token : '';

    const own2Res = await request(app).post('/api/auth/login').send({
      email: 'owner2@phase6c.smartmetrix.test',
      password: 'password123'
    });
    owner2Token = own2Res.body.data ? own2Res.body.data.token : '';

    // Seed Instruments
    // Target in New Delhi (77.2090, 28.6139)
    targetInstrument = await Instrument.create({
      instrumentId: 'INST-6C-TARGET',
      owner: ownerUser._id,
      type: 'WEIGHING_SCALE',
      category: 'BENCH',
      manufacturer: 'METTLER',
      model: 'M-500',
      serialNumber: 'SN-6C-001',
      capacity: { value: 50, unit: 'kg' },
      location: {
        address: 'Connaught Place',
        city: 'New Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
        coordinates: { type: 'Point', coordinates: [77.2090, 28.6139] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });

    // Nearby (~3.8 km away in Karol Bagh 77.1900, 28.6400)
    nearbyInstrument = await Instrument.create({
      instrumentId: 'INST-6C-NEARBY',
      owner: ownerUser._id,
      type: 'WEIGHING_SCALE',
      category: 'BENCH',
      manufacturer: 'METTLER',
      model: 'M-500',
      serialNumber: 'SN-6C-002',
      capacity: { value: 50, unit: 'kg' },
      location: {
        address: 'Karol Bagh',
        city: 'New Delhi',
        district: 'New Delhi',
        state: 'Delhi',
        pincode: '110005',
        coordinates: { type: 'Point', coordinates: [77.1900, 28.6400] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });

    // Far (~140 km away in Agra 78.0080, 27.1767)
    farInstrument = await Instrument.create({
      instrumentId: 'INST-6C-FAR',
      owner: owner2User._id,
      type: 'WEIGHING_SCALE',
      category: 'BENCH',
      manufacturer: 'METTLER',
      model: 'M-500',
      serialNumber: 'SN-6C-003',
      capacity: { value: 50, unit: 'kg' },
      location: {
        address: 'Taj Ganj',
        city: 'Agra',
        district: 'Agra',
        state: 'Uttar Pradesh',
        pincode: '282001',
        coordinates: { type: 'Point', coordinates: [78.0080, 27.1767] }
      },
      status: 'ACTIVE',
      createdBy: adminUser._id,
      updatedBy: adminUser._id
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    await User.deleteMany({ email: { $regex: /@phase6c\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-6C/ } });
    await Inspection.deleteMany({ comments: { $regex: /Phase 6C/ } });
    await RegionalConfig.deleteMany({ name: { $regex: /Phase 6C/ } });
    await RegionalCorrelationAssessment.deleteMany({ disclaimer: { $regex: /Decision support output/ } });
  });

  it('1. Haversine distance utility computes accurate geographic distance', () => {
    const dist = calculateHaversineDistance(
      { longitude: 77.2090, latitude: 28.6139 },
      { longitude: 77.1900, latitude: 28.6400 }
    );
    expect(dist).toBeGreaterThan(2);
    expect(dist).toBeLessThan(6);
  });

  it('2. Multi-factor similarity handles missing factors transparently', () => {
    const target = {
      instrumentId: 'T1',
      type: 'SCALE',
      category: 'BENCH',
      manufacturer: 'A',
      model: 'M1',
      capacityValue: 10,
      capacityUnit: 'kg',
      coordinates: [77.2, 28.6] as [number, number],
      meanDeviationPct: 0.5,
      passRate: 1.0
    };
    const ref = {
      instrumentId: 'R1',
      type: 'SCALE',
      category: 'BENCH',
      manufacturer: 'A',
      model: 'M1',
      capacityValue: 10,
      capacityUnit: 'kg',
      coordinates: [77.21, 28.61] as [number, number],
      meanDeviationPct: 0.5,
      passRate: 1.0
    };

    const weights = {
      haversineDistance: 30,
      typeCategory: 20,
      manufacturerModel: 15,
      ageCapacity: 10,
      deviation: 10,
      complaints: 5,
      repairs: 5,
      inspectionHistory: 5
    };

    const result = calculateInstrumentSimilarity(target, ref, 10, weights);
    expect(result.similarityScore).toBeGreaterThan(80);
    expect(result.missingFactors).toContain('age');
    expect(result.missingFactors).toContain('complaints');
    expect(result.missingFactors).toContain('repairs');
    expect(result.dataCoverage).toBe(63); // 5 of 8 available
  });

  it('3. ADMIN can calculate regional correlation for an instrument', async () => {
    const res = await request(app)
      .post('/api/regional/instruments/INST-6C-TARGET/analyze')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ radiusKm: 10 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    const ass = res.body.data.assessment;
    expect(ass.instrumentIdSnapshot).toBe('INST-6C-TARGET');
    expect(ass.similarInstruments.length).toBeGreaterThanOrEqual(1);
    expect(ass.patternType).toMatch(/Potential Cluster|Correlation|Risk Pattern|INSUFFICIENT_DATA/);
    expect(ass.disclaimer).toContain('Decision support output only');
  });

  it('4. OWNER can view correlation for owned instrument but forbidden for unowned', async () => {
    // Owned instrument
    const res1 = await request(app)
      .get('/api/regional/instruments/INST-6C-TARGET/latest')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.assessment.instrumentIdSnapshot).toBe('INST-6C-TARGET');

    // Unowned instrument
    const res2 = await request(app)
      .get('/api/regional/instruments/INST-6C-FAR/latest')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res2.status).toBe(404); // Scoped out as not found
  });

  it('5. GeoJSON regional map endpoint returns safe FeatureCollection', async () => {
    const res = await request(app)
      .get('/api/regional/map')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.features)).toBe(true);

    const feat = res.body.features.find((f: any) => f.properties.instrumentId === 'INST-6C-TARGET');
    expect(feat).toBeDefined();
    expect(feat.geometry.type).toBe('Point');
    expect(feat.properties.type).toBe('WEIGHING_SCALE');
    expect(feat.properties.patternType).toBeDefined();
  });

  it('6. ADMIN/INSPECTOR can list regional clusters', async () => {
    const res = await request(app)
      .get('/api/regional/clusters')
      .set('Authorization', `Bearer ${inspectorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.clusters)).toBe(true);
  });
});
