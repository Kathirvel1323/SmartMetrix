import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { Counter } from '../src/models/counter.model';
import { resolveRegionCode } from '../src/utils/region.utils';
import { generateInstrumentId } from '../src/utils/instrument-id.utils';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

// Track test records for isolated cleanup
const createdUserIds: mongoose.Types.ObjectId[] = [];
const createdInstrumentIds: mongoose.Types.ObjectId[] = [];

/**
 * Test Database Safety Guard:
 * Strictly ensures any delete, drop, or cleanup operation only executes
 * if the connected database is exactly 'smartmetrix_test'.
 * Aborts immediately otherwise to protect development/production databases.
 */
export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations are strictly restricted to 'smartmetrix_test'. Connected to '${currentDbName}'. Operation aborted.`
    );
  }
};

describe('Phase 3 Integration Tests: Instrument Registration & Digital Passport', () => {
  let owner1Token: string;
  let owner1Id: string;
  let owner2Token: string;
  let owner2Id: string;
  let adminToken: string;
  let inspectorToken: string;

  let owner1InstrumentId: string;
  let owner2InstrumentId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.JWT_EXPIRES_IN = '1h';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    // Safety guard verification immediately on connect
    assertTestDatabaseSafety();

    // Seed Owner 1
    const owner1 = new User({
      name: 'Owner One',
      email: `owner1_${Date.now()}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner1.save();
    createdUserIds.push(owner1._id as mongoose.Types.ObjectId);
    owner1Id = owner1._id.toString();

    // Seed Owner 2
    const owner2 = new User({
      name: 'Owner Two',
      email: `owner2_${Date.now()}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner2.save();
    createdUserIds.push(owner2._id as mongoose.Types.ObjectId);
    owner2Id = owner2._id.toString();

    // Seed Admin
    const admin = new User({
      name: 'Phase 3 Admin',
      email: `admin_${Date.now()}@test.local`,
      password: 'AdminPassword123!',
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });
    await admin.save();
    createdUserIds.push(admin._id as mongoose.Types.ObjectId);

    // Seed Inspector
    const inspector = new User({
      name: 'Phase 3 Inspector',
      email: `inspector_${Date.now()}@test.local`,
      password: 'InspectorPassword123!',
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });
    await inspector.save();
    createdUserIds.push(inspector._id as mongoose.Types.ObjectId);

    // Log in all users to get tokens
    const [resO1, resO2, resAdmin, resInsp] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: owner1.email, password: 'OwnerPassword123!' }),
      request(app).post('/api/auth/login').send({ email: owner2.email, password: 'OwnerPassword123!' }),
      request(app).post('/api/auth/login').send({ email: admin.email, password: 'AdminPassword123!' }),
      request(app).post('/api/auth/login').send({ email: inspector.email, password: 'InspectorPassword123!' })
    ]);

    owner1Token = resO1.body.data.token;
    owner2Token = resO2.body.data.token;
    adminToken = resAdmin.body.data.token;
    inspectorToken = resInsp.body.data.token;
  });

  afterAll(async () => {
    // Safety guard verification before any cleanup
    assertTestDatabaseSafety();

    // Clean up only test created records
    if (createdInstrumentIds.length > 0) {
      await Instrument.deleteMany({ _id: { $in: createdInstrumentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    // Safe test cleanup: do NOT broadly delete all WM-* counters
    await mongoose.disconnect();
  });

  describe('0. Database Safety Guard', () => {
    it('strictly verifies connected database is smartmetrix_test and throws on mismatch', () => {
      const currentDb = mongoose.connection.db?.databaseName || mongoose.connection.name;
      expect(currentDb).toBe('smartmetrix_test');
      expect(() => {
        const checkDb = (db: string) => {
          if (db !== 'smartmetrix_test') {
            throw new Error(`SAFETY GUARD ABORT: Expected 'smartmetrix_test', got '${db}'`);
          }
        };
        checkDb('smartmetrix');
      }).toThrow(/SAFETY GUARD ABORT/);
    });
  });

  describe('1. Health Endpoint Verification', () => {
    it('GET /api/health should still return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('2. Instrument Registration', () => {
    it('OWNER can register an instrument for themselves', async () => {
      const payload = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Avery Weigh-Tronix',
        model: 'Z205',
        serialNumber: `SN-MDU-${Date.now()}`,
        capacity: {
          value: 300,
          unit: 'kg'
        },
        accuracyClass: 'Class III',
        location: {
          address: '12 Temple St',
          city: 'Madurai',
          district: 'Madurai',
          state: 'Tamil Nadu',
          pincode: '625001',
          coordinates: {
            type: 'Point',
            coordinates: [78.1198, 9.9252] // lon, lat
          }
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.instrument).toBeDefined();

      const inst = res.body.data.instrument;
      expect(inst.instrumentId).toMatch(/^WM-MDU-\d{5}$/);
      expect(inst.owner.toString()).toBe(owner1Id);
      expect(inst.status).toBe('REGISTERED');
      expect(inst.lifecycleHistory).toHaveLength(1);
      expect(inst.lifecycleHistory[0].eventType).toBe('REGISTRATION');
      expect(inst.isArchived).toBe(false);

      owner1InstrumentId = inst.instrumentId;
      createdInstrumentIds.push(new mongoose.Types.ObjectId(inst._id));
    });

    it('OWNER cannot assign another owner during registration', async () => {
      const payload = {
        type: 'FUEL_DISPENSER',
        category: 'VOLUME_MEASUREMENT',
        manufacturer: 'Wayne Fueling',
        model: 'Ovation',
        serialNumber: `SN-CHE-${Date.now()}`,
        capacity: {
          value: 50,
          unit: 'l'
        },
        location: {
          address: '100 Mount Road',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: {
            type: 'Point',
            coordinates: [80.2707, 13.0827]
          }
        },
        ownerId: owner2Id // Malicious attempt to assign to owner 2
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payload);

      expect(res.status).toBe(201);
      // Must be forced to owner1
      expect(res.body.data.instrument.owner.toString()).toBe(owner1Id);
      createdInstrumentIds.push(new mongoose.Types.ObjectId(res.body.data.instrument._id));
    });

    it('ADMIN can register an instrument for a valid OWNER', async () => {
      const payload = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Essae',
        model: 'DS-215',
        serialNumber: `SN-OWNER2-${Date.now()}`,
        capacity: {
          value: 15,
          unit: 'kg'
        },
        location: {
          address: '45 Anna Salai',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: {
            type: 'Point',
            coordinates: [80.2707, 13.0827]
          }
        },
        ownerId: owner2Id
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.instrument.owner.toString()).toBe(owner2Id);
      expect(res.body.data.instrument.instrumentId).toMatch(/^WM-CHE-\d{5}$/);

      owner2InstrumentId = res.body.data.instrument.instrumentId;
      createdInstrumentIds.push(new mongoose.Types.ObjectId(res.body.data.instrument._id));
    });

    it('ADMIN registration rejects invalid or non-existent ownerId with 400', async () => {
      const payload = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Essae',
        model: 'DS-215',
        serialNumber: `SN-INVALID-${Date.now()}`,
        capacity: { value: 15, unit: 'kg' },
        location: {
          address: '45 Anna Salai',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: { type: 'Point', coordinates: [80.2707, 13.0827] }
        },
        ownerId: new mongoose.Types.ObjectId().toString() // Non-existent
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('INSPECTOR cannot register instruments (403 Forbidden)', async () => {
      const payload = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Essae',
        model: 'DS-215',
        serialNumber: `SN-INSP-${Date.now()}`,
        capacity: { value: 15, unit: 'kg' },
        location: {
          address: '1 Test St',
          city: 'Madurai',
          district: 'Madurai',
          state: 'Tamil Nadu',
          pincode: '625001',
          coordinates: { type: 'Point', coordinates: [78.11, 9.92] }
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send(payload);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });

    it('Rejects invalid coordinates, negative capacity, and invalid pincode with 400', async () => {
      const basePayload = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Test Mfg',
        model: 'M1',
        serialNumber: `SN-TEST-${Date.now()}`,
        capacity: { value: -5, unit: 'kg' }, // Invalid negative capacity
        location: {
          address: '1 Test St',
          city: 'Madurai',
          district: 'Madurai',
          state: 'Tamil Nadu',
          pincode: '12345', // Invalid 5-digit pincode
          coordinates: { type: 'Point', coordinates: [200, 95] } // Invalid coordinates
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(basePayload);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    it('Rejects case-insensitive duplicate manufacturer + serial number with 409 Conflict', async () => {
      const dupSerial = `DUPLICATE-${Date.now()}`;
      const payload1 = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Mettler Toledo',
        model: 'MS-TS',
        serialNumber: dupSerial,
        capacity: { value: 10, unit: 'kg' },
        location: {
          address: '100 Main St',
          city: 'Madurai',
          district: 'Madurai',
          state: 'Tamil Nadu',
          pincode: '625001',
          coordinates: { type: 'Point', coordinates: [78.11, 9.92] }
        }
      };

      const res1 = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payload1);

      expect(res1.status).toBe(201);
      createdInstrumentIds.push(new mongoose.Types.ObjectId(res1.body.data.instrument._id));

      // Attempt duplicate with different casing
      const payload2 = {
        ...payload1,
        manufacturer: 'mettler toledo',
        serialNumber: dupSerial.toLowerCase()
      };

      const res2 = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payload2);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('already exists');
    });

    it('Generates unique sequential IDs matching WM-REGION-00000 format', async () => {
      const payloadA = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'BrandA',
        model: 'A1',
        serialNumber: `SN-SEQ-A-${Date.now()}`,
        capacity: { value: 5, unit: 'kg' },
        location: {
          address: '1 St',
          city: 'Coimbatore',
          district: 'Coimbatore',
          state: 'Tamil Nadu',
          pincode: '641001',
          coordinates: { type: 'Point', coordinates: [76.9558, 11.0168] }
        }
      };

      const payloadB = {
        ...payloadA,
        manufacturer: 'BrandB',
        model: 'B1',
        serialNumber: `SN-SEQ-B-${Date.now()}`
      };

      const [resA, resB] = await Promise.all([
        request(app).post('/api/instruments').set('Authorization', `Bearer ${owner1Token}`).send(payloadA),
        request(app).post('/api/instruments').set('Authorization', `Bearer ${owner1Token}`).send(payloadB)
      ]);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);

      const idA = resA.body.data.instrument.instrumentId;
      const idB = resB.body.data.instrument.instrumentId;

      expect(idA).toMatch(/^WM-CBE-\d{5}$/);
      expect(idB).toMatch(/^WM-CBE-\d{5}$/);
      expect(idA).not.toBe(idB);

      createdInstrumentIds.push(new mongoose.Types.ObjectId(resA.body.data.instrument._id));
      createdInstrumentIds.push(new mongoose.Types.ObjectId(resB.body.data.instrument._id));
    });

    it('Correctly resolves New Delhi with various casing and spacing to DEL', async () => {
      expect(resolveRegionCode('New Delhi')).toBe('DEL');
      expect(resolveRegionCode('new delhi')).toBe('DEL');
      expect(resolveRegionCode('  New   Delhi  ')).toBe('DEL');
      expect(resolveRegionCode('NEW DELHI')).toBe('DEL');

      // Register an instrument in New Delhi and confirm WM-DEL- prefix
      const payloadDelhi = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Delhi Scale Works',
        model: 'DSW-100',
        serialNumber: `SN-DELHI-${Date.now()}`,
        capacity: { value: 100, unit: 'kg' },
        location: {
          address: 'Connaught Place',
          city: 'New Delhi',
          district: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          coordinates: { type: 'Point', coordinates: [77.2167, 28.6328] }
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payloadDelhi);

      expect(res.status).toBe(201);
      expect(res.body.data.instrument.instrumentId).toMatch(/^WM-DEL-\d{5}$/);
      createdInstrumentIds.push(new mongoose.Types.ObjectId(res.body.data.instrument._id));
    });

    it('Nationwide usage: registers instruments for unmapped cities using deterministic fallback without restriction', async () => {
      // Unmapped cities should derive their 3-letter code from the first 3 letters
      expect(resolveRegionCode('Kanpur')).toBe('KAN');
      expect(resolveRegionCode('Guwahati')).toBe('GUW');
      expect(resolveRegionCode('Ranchi')).toBe('RAN');

      // Fallback hierarchy: empty city falls back to district, then state, then GEN
      expect(resolveRegionCode('', 'Madurai', 'Tamil Nadu')).toBe('MDU');
      expect(resolveRegionCode('   ', '   ', '   ')).toBe('GEN');

      // Register an instrument for an unmapped city (Kanpur) successfully
      const payloadKanpur = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Kanpur Metrix',
        model: 'KM-50',
        serialNumber: `SN-KAN-${Date.now()}`,
        capacity: { value: 50, unit: 'kg' },
        location: {
          address: 'Mall Road',
          city: 'Kanpur',
          district: 'Kanpur Nagar',
          state: 'Uttar Pradesh',
          pincode: '208001',
          coordinates: { type: 'Point', coordinates: [80.3319, 26.4499] }
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payloadKanpur);

      expect(res.status).toBe(201);
      expect(res.body.data.instrument.instrumentId).toMatch(/^WM-KAN-\d{5}$/);
      createdInstrumentIds.push(new mongoose.Types.ObjectId(res.body.data.instrument._id));
    });

    it('Rejects empty or whitespace-only location fields with 400', async () => {
      const payloadEmptyCity = {
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Essae',
        model: 'M1',
        serialNumber: `SN-EMPTY-${Date.now()}`,
        capacity: { value: 10, unit: 'kg' },
        location: {
          address: '100 Main St',
          city: '   ', // whitespace only
          district: 'District',
          state: 'State',
          pincode: '600001',
          coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
        }
      };

      const res = await request(app)
        .post('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(payloadEmptyCity);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Complete location');
    });

    it('Counter concurrency: simultaneously requests multiple IDs for the same new region and ensures all IDs are collision-free and unique', async () => {
      const testRegionCity = `ConcurrencyRegion${Date.now()}`;
      const concurrentRequests = 10;

      const generatedIds = await Promise.all(
        Array.from({ length: concurrentRequests }, () =>
          generateInstrumentId(testRegionCity, 'RaceDistrict', 'Tamil Nadu')
        )
      );

      expect(generatedIds).toHaveLength(concurrentRequests);

      // Verify all IDs follow the WM-CON-XXXXX pattern
      for (const id of generatedIds) {
        expect(id).toMatch(/^WM-CON-\d{5}$/);
      }

      // Verify every single ID is strictly unique (no collision during first concurrent upsert)
      const uniqueIds = new Set(generatedIds);
      expect(uniqueIds.size).toBe(concurrentRequests);
    });
  });

  describe('3. Instrument Listing & Scoping', () => {
    it('OWNER list returns only instruments owned by the caller', async () => {
      const res = await request(app)
        .get('/api/instruments')
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify all items belong to Owner 1
      for (const inst of res.body.data) {
        expect(inst.owner._id.toString()).toBe(owner1Id);
      }

      // Ensure Owner 2's instrument is absent
      const hasOwner2Inst = res.body.data.some((i: any) => i.instrumentId === owner2InstrumentId);
      expect(hasOwner2Inst).toBe(false);
    });

    it('INSPECTOR and ADMIN can view all registered instruments', async () => {
      const [resInsp, resAdmin] = await Promise.all([
        request(app).get('/api/instruments').set('Authorization', `Bearer ${inspectorToken}`),
        request(app).get('/api/instruments').set('Authorization', `Bearer ${adminToken}`)
      ]);

      expect(resInsp.status).toBe(200);
      expect(resAdmin.status).toBe(200);

      const inspIds = resInsp.body.data.map((i: any) => i.instrumentId);
      const adminIds = resAdmin.body.data.map((i: any) => i.instrumentId);

      expect(inspIds).toContain(owner1InstrumentId);
      expect(inspIds).toContain(owner2InstrumentId);
      expect(adminIds).toContain(owner1InstrumentId);
      expect(adminIds).toContain(owner2InstrumentId);
    });

    it('Filters instruments safely by status and city', async () => {
      const res = await request(app)
        .get('/api/instruments?city=Madurai&status=REGISTERED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const inst of res.body.data) {
        expect(inst.location.city.toLowerCase()).toBe('madurai');
        expect(inst.status).toBe('REGISTERED');
      }
    });
  });

  describe('4. Single Instrument Access Control', () => {
    it('OWNER can access their own instrument', async () => {
      const res = await request(app)
        .get(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.instrument.instrumentId).toBe(owner1InstrumentId);
    });

    it('OWNER cannot access another owner’s instrument (404/Not Found)', async () => {
      const res = await request(app)
        .get(`/api/instruments/${owner2InstrumentId}`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(404);
    });

    it('INSPECTOR and ADMIN can access any permitted instrument', async () => {
      const [resInsp, resAdmin] = await Promise.all([
        request(app).get(`/api/instruments/${owner1InstrumentId}`).set('Authorization', `Bearer ${inspectorToken}`),
        request(app).get(`/api/instruments/${owner1InstrumentId}`).set('Authorization', `Bearer ${adminToken}`)
      ]);

      expect(resInsp.status).toBe(200);
      expect(resAdmin.status).toBe(200);
      expect(resInsp.body.data.instrument.instrumentId).toBe(owner1InstrumentId);
      expect(resAdmin.body.data.instrument.instrumentId).toBe(owner1InstrumentId);
    });
  });

  describe('5. Instrument Updates & Lifecycle Immutability', () => {
    it('OWNER can update safe editable fields and lifecycle event is appended', async () => {
      const updatePayload = {
        model: 'Z205-Updated',
        capacity: { value: 350, unit: 'kg' },
        location: {
          address: '99 New Temple St',
          city: 'Madurai',
          district: 'Madurai',
          state: 'Tamil Nadu',
          pincode: '625001'
        },
        // Protected fields that should be rejected or ignored
        instrumentId: 'WM-HACK-99999',
        owner: owner2Id,
        lifecycleHistory: []
      };

      const res = await request(app)
        .patch(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      const updated = res.body.data.instrument;

      // Safe fields updated
      expect(updated.model).toBe('Z205-Updated');
      expect(updated.capacity.value).toBe(350);
      expect(updated.location.address).toBe('99 New Temple St');

      // Protected fields remained intact
      expect(updated.instrumentId).toBe(owner1InstrumentId);
      expect(updated.owner.toString()).toBe(owner1Id);

      // Lifecycle history appended (not overwritten)
      expect(updated.lifecycleHistory.length).toBe(2);
      expect(updated.lifecycleHistory[1].eventType).toBe('DETAIL_UPDATE');
    });

    it('No-op PATCH with identical field values does not append lifecycle events', async () => {
      // Get current lifecycle history length (which is 2 after previous update)
      const currentRes = await request(app)
        .get(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      const historyLengthBefore = currentRes.body.data.instrument.lifecycleHistory.length;

      // Send PATCH with exact same model, capacity, and location as already stored
      const noopRes = await request(app)
        .patch(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          model: 'Z205-Updated',
          capacity: { value: 350, unit: 'kg' },
          location: {
            address: '99 New Temple St',
            city: 'Madurai',
            district: 'Madurai',
            state: 'Tamil Nadu',
            pincode: '625001'
          }
        });

      expect(noopRes.status).toBe(200);
      const updated = noopRes.body.data.instrument;
      // Lifecycle history must NOT have grown
      expect(updated.lifecycleHistory.length).toBe(historyLengthBefore);
    });

    it('Status changes append STATUS_CHANGE, while identical status update is a no-op', async () => {
      // ADMIN changes status from REGISTERED to UNDER_VERIFICATION (genuine change)
      const changeRes = await request(app)
        .patch(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNDER_VERIFICATION' });

      expect(changeRes.status).toBe(200);
      const updated = changeRes.body.data.instrument;
      expect(updated.status).toBe('UNDER_VERIFICATION');
      expect(updated.lifecycleHistory.length).toBe(3);
      expect(updated.lifecycleHistory[2].eventType).toBe('STATUS_CHANGE');

      // ADMIN sends identical status again (no-op)
      const noopRes = await request(app)
        .patch(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNDER_VERIFICATION' });

      expect(noopRes.status).toBe(200);
      // Must remain at 3 events
      expect(noopRes.body.data.instrument.lifecycleHistory.length).toBe(3);
    });

    it('INSPECTOR cannot update instruments (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ model: 'Inspector-Hack' });

      expect(res.status).toBe(403);
    });
  });

  describe('6. Archival (Soft Delete)', () => {
    it('OWNER cannot archive an instrument (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/instruments/${owner1InstrumentId}/archive`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(403);
    });

    it('ADMIN can soft-archive an instrument and append an ARCHIVED lifecycle event', async () => {
      const res = await request(app)
        .post(`/api/instruments/${owner1InstrumentId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const inst = res.body.data.instrument;
      expect(inst.isArchived).toBe(true);
      expect(inst.archivedAt).toBeDefined();

      const lastEvent = inst.lifecycleHistory[inst.lifecycleHistory.length - 1];
      expect(lastEvent.eventType).toBe('ARCHIVED');
    });

    it('Archived document still exists in MongoDB and is hidden from default listings', async () => {
      // Document still physically exists in database
      const dbDoc = await Instrument.findOne({ instrumentId: owner1InstrumentId });
      expect(dbDoc).not.toBeNull();
      expect(dbDoc?.isArchived).toBe(true);

      // Hidden from default list
      const defaultListRes = await request(app)
        .get('/api/instruments')
        .set('Authorization', `Bearer ${adminToken}`);
      const ids = defaultListRes.body.data.map((i: any) => i.instrumentId);
      expect(ids).not.toContain(owner1InstrumentId);

      // Visible when includeArchived=true for ADMIN
      const archivedListRes = await request(app)
        .get('/api/instruments?includeArchived=true')
        .set('Authorization', `Bearer ${adminToken}`);
      const archivedIds = archivedListRes.body.data.map((i: any) => i.instrumentId);
      expect(archivedIds).toContain(owner1InstrumentId);
    });

    it('Physical DELETE endpoint does not exist (404 Not Found)', async () => {
      const res = await request(app)
        .delete(`/api/instruments/${owner1InstrumentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('7. Digital Instrument Passport', () => {
    it('Returns genuine stored passport data without fabrication for OWNER', async () => {
      const res = await request(app)
        .get(`/api/instruments/${owner2InstrumentId}/passport`)
        .set('Authorization', `Bearer ${owner2Token}`);

      expect(res.status).toBe(200);
      const passport = res.body.data.passport;

      expect(passport.passportVersion).toBe('1.0');
      expect(passport.identity.instrumentId).toBe(owner2InstrumentId);
      expect(passport.identity.type).toBe('WEIGHING_SCALE');
      expect(passport.identity.manufacturer).toBe('Essae');
      expect(passport.specifications.capacity.value).toBe(15);
      expect(passport.specifications.capacity.unit).toBe('kg');
      expect(passport.location.city).toBe('Chennai');
      expect(passport.owner.name).toBe('Owner Two');
      expect(passport.status).toBe('REGISTERED');
      expect(passport.currentCertificate).toBeNull(); // No fabricated certificate
      expect(Array.isArray(passport.lifecycleTimeline)).toBe(true);
      expect(passport.lifecycleTimeline.length).toBeGreaterThan(0);
    });

    it('OWNER cannot access another owner’s passport (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/instruments/${owner2InstrumentId}/passport`)
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(404);
    });

    it('INSPECTOR and ADMIN can access permitted passports', async () => {
      const [resInsp, resAdmin] = await Promise.all([
        request(app).get(`/api/instruments/${owner2InstrumentId}/passport`).set('Authorization', `Bearer ${inspectorToken}`),
        request(app).get(`/api/instruments/${owner2InstrumentId}/passport`).set('Authorization', `Bearer ${adminToken}`)
      ]);

      expect(resInsp.status).toBe(200);
      expect(resAdmin.status).toBe(200);
      expect(resInsp.body.data.passport.identity.instrumentId).toBe(owner2InstrumentId);
      expect(resAdmin.body.data.passport.identity.instrumentId).toBe(owner2InstrumentId);
    });
  });
});
