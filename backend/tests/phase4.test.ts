import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { generateVerificationRequestId } from '../src/utils/verification-id.utils';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

// Track test record IDs for isolated, safe cleanup
const createdUserIds: mongoose.Types.ObjectId[] = [];
const createdInstrumentIds: mongoose.Types.ObjectId[] = [];
const createdVerificationIds: mongoose.Types.ObjectId[] = [];

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

describe('Phase 4 Integration Tests: Verification Request, Inspector Assignment & Manual Scheduling', () => {
  let owner1Token: string;
  let owner1Id: string;
  let owner2Token: string;
  let owner2Id: string;
  let adminToken: string;
  let adminId: string;
  let inspector1Token: string;
  let inspector1Id: string;
  let inspector2Token: string;
  let inspector2Id: string;

  let owner1InstrumentId: string;
  let owner1InstrumentMongoId: mongoose.Types.ObjectId;
  let owner2InstrumentId: string;
  let owner2InstrumentMongoId: mongoose.Types.ObjectId;
  let archivedInstrumentId: string;
  let archivedInstrumentMongoId: mongoose.Types.ObjectId;

  let testRequestId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.JWT_EXPIRES_IN = '1h';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    // Safety guard verification immediately upon connection
    assertTestDatabaseSafety();

    // Ensure partial unique indexes are created in smartmetrix_test
    try {
      await VerificationRequest.collection.dropIndex('instrument_1');
    } catch {
      // Ignored if legacy index doesn't exist
    }
    await VerificationRequest.syncIndexes();

    const timestamp = Date.now();

    // 1. Seed Owner 1
    const owner1 = new User({
      name: 'Owner Four A',
      email: `owner4a_${timestamp}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner1.save();
    createdUserIds.push(owner1._id as mongoose.Types.ObjectId);
    owner1Id = owner1._id.toString();

    // 2. Seed Owner 2
    const owner2 = new User({
      name: 'Owner Four B',
      email: `owner4b_${timestamp}@test.local`,
      password: 'OwnerPassword123!',
      role: 'OWNER',
      isActive: true,
      tokenVersion: 0
    });
    await owner2.save();
    createdUserIds.push(owner2._id as mongoose.Types.ObjectId);
    owner2Id = owner2._id.toString();

    // 3. Seed Admin
    const admin = new User({
      name: 'Admin Four',
      email: `admin4_${timestamp}@test.local`,
      password: 'AdminPassword123!',
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });
    await admin.save();
    createdUserIds.push(admin._id as mongoose.Types.ObjectId);
    adminId = admin._id.toString();

    // 4. Seed Inspector 1
    const inspector1 = new User({
      name: 'Inspector Four One',
      email: `inspector4a_${timestamp}@test.local`,
      password: 'InspectorPassword123!',
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });
    await inspector1.save();
    createdUserIds.push(inspector1._id as mongoose.Types.ObjectId);
    inspector1Id = inspector1._id.toString();

    // 5. Seed Inspector 2
    const inspector2 = new User({
      name: 'Inspector Four Two',
      email: `inspector4b_${timestamp}@test.local`,
      password: 'InspectorPassword123!',
      role: 'INSPECTOR',
      isActive: true,
      tokenVersion: 0
    });
    await inspector2.save();
    createdUserIds.push(inspector2._id as mongoose.Types.ObjectId);
    inspector2Id = inspector2._id.toString();

    // Authenticate all users
    const [resO1, resO2, resAdmin, resInsp1, resInsp2] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: owner1.email, password: 'OwnerPassword123!' }),
      request(app).post('/api/auth/login').send({ email: owner2.email, password: 'OwnerPassword123!' }),
      request(app).post('/api/auth/login').send({ email: admin.email, password: 'AdminPassword123!' }),
      request(app).post('/api/auth/login').send({ email: inspector1.email, password: 'InspectorPassword123!' }),
      request(app).post('/api/auth/login').send({ email: inspector2.email, password: 'InspectorPassword123!' })
    ]);

    owner1Token = resO1.body.data.token;
    owner2Token = resO2.body.data.token;
    adminToken = resAdmin.body.data.token;
    inspector1Token = resInsp1.body.data.token;
    inspector2Token = resInsp2.body.data.token;

    // Seed test instruments for owner 1
    const inst1 = new Instrument({
      instrumentId: `WM-CHE-${Math.floor(10000 + Math.random() * 90000)}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Avery Weigh-Tronix',
      model: 'Z205',
      serialNumber: `SN-P4-A-${timestamp}`,
      capacity: { value: 100, unit: 'kg' },
      location: {
        address: '100 Mount Rd',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600002',
        coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
      },
      status: 'REGISTERED',
      lifecycleHistory: [],
      isArchived: false,
      createdBy: owner1._id,
      updatedBy: owner1._id
    });
    await inst1.save();
    owner1InstrumentId = inst1.instrumentId;
    owner1InstrumentMongoId = inst1._id as mongoose.Types.ObjectId;
    createdInstrumentIds.push(inst1._id as mongoose.Types.ObjectId);

    // Seed test instrument for owner 2
    const inst2 = new Instrument({
      instrumentId: `WM-MDU-${Math.floor(10000 + Math.random() * 90000)}`,
      owner: owner2._id,
      type: 'FUEL_DISPENSER',
      category: 'VOLUME_MEASUREMENT',
      manufacturer: 'Wayne Fueling',
      model: 'Ovation-P4',
      serialNumber: `SN-P4-B-${timestamp}`,
      capacity: { value: 50, unit: 'l' },
      location: {
        address: '12 Temple St',
        city: 'Madurai',
        district: 'Madurai',
        state: 'Tamil Nadu',
        pincode: '625001',
        coordinates: { type: 'Point', coordinates: [78.11, 9.92] }
      },
      status: 'REGISTERED',
      lifecycleHistory: [],
      isArchived: false,
      createdBy: owner2._id,
      updatedBy: owner2._id
    });
    await inst2.save();
    owner2InstrumentId = inst2.instrumentId;
    owner2InstrumentMongoId = inst2._id as mongoose.Types.ObjectId;
    createdInstrumentIds.push(inst2._id as mongoose.Types.ObjectId);

    // Seed an archived instrument for owner 1
    const instArchived = new Instrument({
      instrumentId: `WM-CBE-${Math.floor(10000 + Math.random() * 90000)}`,
      owner: owner1._id,
      type: 'WEIGHING_SCALE',
      category: 'NON_AUTOMATIC_WEIGHING',
      manufacturer: 'Essae',
      model: 'DS-Archived',
      serialNumber: `SN-P4-ARC-${timestamp}`,
      capacity: { value: 30, unit: 'kg' },
      location: {
        address: '45 Cross Cut Rd',
        city: 'Coimbatore',
        district: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641001',
        coordinates: { type: 'Point', coordinates: [76.96, 11.01] }
      },
      status: 'REGISTERED',
      lifecycleHistory: [],
      isArchived: true,
      archivedAt: new Date(),
      createdBy: owner1._id,
      updatedBy: owner1._id
    });
    await instArchived.save();
    archivedInstrumentId = instArchived.instrumentId;
    archivedInstrumentMongoId = instArchived._id as mongoose.Types.ObjectId;
    createdInstrumentIds.push(instArchived._id as mongoose.Types.ObjectId);
  });

  afterAll(async () => {
    // Safety guard verification before any cleanup
    assertTestDatabaseSafety();

    if (createdVerificationIds.length > 0) {
      await VerificationRequest.deleteMany({ _id: { $in: createdVerificationIds } });
    }
    if (createdInstrumentIds.length > 0) {
      await Instrument.deleteMany({ _id: { $in: createdInstrumentIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
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

    it('confirms the active-request unique partial index exists on instrument in MongoDB', async () => {
      const indexes = await VerificationRequest.collection.indexes();
      const activeIndex = indexes.find(
        (idx: any) => idx.unique && idx.key && idx.key.instrument === 1 && idx.partialFilterExpression
      );
      expect(activeIndex).toBeDefined();
      expect(activeIndex.partialFilterExpression).toBeDefined();
      expect(activeIndex.partialFilterExpression.status).toBeDefined();
      expect(activeIndex.partialFilterExpression.status.$in).toContain('SUBMITTED');
      expect(activeIndex.partialFilterExpression.status.$in).toContain('CERTIFICATE_ISSUED');
    });
  });

  describe('1. Health Check Endpoint', () => {
    it('GET /api/health returns 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('2. Verification Request Submission (OWNER)', () => {
    it('OWNER can submit an INITIAL verification request for their instrument', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: owner1InstrumentId,
          verificationType: 'INITIAL',
          remarks: 'Initial calibration verification request'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.verification).toBeDefined();

      const vrf = res.body.data.verification;
      expect(vrf.requestId).toMatch(/^VRF-\d{4}-\d{5}$/);
      expect(vrf.status).toBe('SUBMITTED');
      expect(vrf.verificationType).toBe('INITIAL');
      expect(vrf.owner.toString()).toBe(owner1Id);
      expect(vrf.instrument.toString()).toBe(owner1InstrumentMongoId.toString());
      expect(vrf.statusHistory).toHaveLength(1);
      expect(vrf.statusHistory[0].status).toBe('SUBMITTED');

      testRequestId = vrf.requestId;
      createdVerificationIds.push(new mongoose.Types.ObjectId(vrf._id));
    });

    it('Rejects client-supplied system/protected fields (e.g. status override, fake requestId)', async () => {
      // Create another instrument for owner 1
      const inst = new Instrument({
        instrumentId: `WM-CHE-${Math.floor(10000 + Math.random() * 90000)}`,
        owner: new mongoose.Types.ObjectId(owner1Id),
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Essae',
        model: 'DS-2',
        serialNumber: `SN-P4-TAMPER-${Date.now()}`,
        capacity: { value: 10, unit: 'kg' },
        location: {
          address: '1 Main Rd',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
        },
        status: 'REGISTERED',
        lifecycleHistory: [],
        isArchived: false,
        createdBy: new mongoose.Types.ObjectId(owner1Id),
        updatedBy: new mongoose.Types.ObjectId(owner1Id)
      });
      await inst.save();
      createdInstrumentIds.push(inst._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: inst.instrumentId,
          verificationType: 'INITIAL',
          requestId: 'VRF-HACK-99999', // Client-supplied requestId attempt
          status: 'PASSED' // Client-supplied status jump attempt
        });

      expect(res.status).toBe(201);
      // Status must remain SUBMITTED, and requestId must follow system counter format
      expect(res.body.data.verification.status).toBe('SUBMITTED');
      expect(res.body.data.verification.requestId).toMatch(/^VRF-\d{4}-\d{5}$/);
      expect(res.body.data.verification.requestId).not.toBe('VRF-HACK-99999');

      createdVerificationIds.push(new mongoose.Types.ObjectId(res.body.data.verification._id));
    });

    it('Rejects request for foreign instrument belonging to another owner (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: owner2InstrumentId, // Belongs to owner 2
          verificationType: 'INITIAL'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You do not own this instrument');
    });

    it('Rejects request for archived instrument (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: archivedInstrumentId,
          verificationType: 'INITIAL'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Archived instruments cannot be submitted');
    });

    it('Rejects request for non-existent instrument (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: 'WM-XXX-99999',
          verificationType: 'INITIAL'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Referenced instrument not found');
    });

    it('Rejects duplicate active verification requests for the same instrument (409 Conflict)', async () => {
      // owner1InstrumentId already has testRequestId active in SUBMITTED status
      const res = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: owner1InstrumentId,
          verificationType: 'RE_VERIFICATION'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('An active verification request already exists');
    });

    it('Database-enforced active-request uniqueness: multiple simultaneous submissions for the same instrument allow exactly one success and rest 409', async () => {
      // Create a fresh instrument for this concurrency race test
      const concInst = new Instrument({
        instrumentId: `WM-CHE-${Math.floor(10000 + Math.random() * 90000)}`,
        owner: new mongoose.Types.ObjectId(owner1Id),
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'RaceScale',
        model: 'RS-100',
        serialNumber: `SN-CONC-${Date.now()}`,
        capacity: { value: 50, unit: 'kg' },
        location: {
          address: '10 Racecourse Rd',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
        },
        status: 'REGISTERED',
        lifecycleHistory: [],
        isArchived: false,
        createdBy: new mongoose.Types.ObjectId(owner1Id),
        updatedBy: new mongoose.Types.ObjectId(owner1Id)
      });
      await concInst.save();
      createdInstrumentIds.push(concInst._id as mongoose.Types.ObjectId);

      // Submit 5 simultaneous requests for this instrument
      const simultaneousRequests = 5;
      const results = await Promise.all(
        Array.from({ length: simultaneousRequests }, () =>
          request(app)
            .post('/api/verifications')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
              instrumentId: concInst.instrumentId,
              verificationType: 'INITIAL'
            })
        )
      );

      const successResponses = results.filter((r) => r.status === 201);
      const conflictResponses = results.filter((r) => r.status === 409);

      expect(successResponses).toHaveLength(1);
      expect(conflictResponses).toHaveLength(simultaneousRequests - 1);
      for (const cr of conflictResponses) {
        expect(cr.body.message).toContain('already exists');
      }

      createdVerificationIds.push(
        new mongoose.Types.ObjectId(successResponses[0].body.data.verification._id)
      );
    });

    it('INSPECTOR and ADMIN cannot submit verification requests (403 Forbidden)', async () => {
      const [resInsp, resAdmin] = await Promise.all([
        request(app)
          .post('/api/verifications')
          .set('Authorization', `Bearer ${inspector1Token}`)
          .send({ instrumentId: owner1InstrumentId, verificationType: 'INITIAL' }),
        request(app)
          .post('/api/verifications')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ instrumentId: owner1InstrumentId, verificationType: 'INITIAL' })
      ]);

      expect(resInsp.status).toBe(403);
      expect(resAdmin.status).toBe(403);
    });
  });

  describe('3. Verification Listing & Role-Scoped Access', () => {
    let owner2RequestId: string;

    beforeAll(async () => {
      // Create a verification for Owner 2
      const resO2 = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({
          instrumentId: owner2InstrumentId,
          verificationType: 'INITIAL'
        });
      owner2RequestId = resO2.body.data.verification.requestId;
      createdVerificationIds.push(new mongoose.Types.ObjectId(resO2.body.data.verification._id));
    });

    it('OWNER sees only their own verification requests', async () => {
      const res = await request(app)
        .get('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const requestIds = res.body.data.map((r: any) => r.requestId);
      expect(requestIds).toContain(testRequestId);
      expect(requestIds).not.toContain(owner2RequestId);

      for (const item of res.body.data) {
        expect(item.owner._id.toString()).toBe(owner1Id);
      }
    });

    it('ADMIN can see all verification requests', async () => {
      const res = await request(app)
        .get('/api/verifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const requestIds = res.body.data.map((r: any) => r.requestId);
      expect(requestIds).toContain(testRequestId);
      expect(requestIds).toContain(owner2RequestId);
    });

    it('INSPECTOR sees only requests assigned to them (initially 0 before assignment)', async () => {
      const res = await request(app)
        .get('/api/verifications')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      const assignedIds = res.body.data.map((r: any) => r.requestId);
      expect(assignedIds).not.toContain(testRequestId);
      expect(assignedIds).not.toContain(owner2RequestId);
    });

    it('Filters verification requests by status and verificationType safely', async () => {
      const res = await request(app)
        .get('/api/verifications?status=SUBMITTED&verificationType=INITIAL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const vrf of res.body.data) {
        expect(vrf.status).toBe('SUBMITTED');
        expect(vrf.verificationType).toBe('INITIAL');
      }
    });

    it('Single request retrieval: OWNER can view their request, but gets 404 for another owner request', async () => {
      const resOwn = await request(app)
        .get(`/api/verifications/${testRequestId}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(resOwn.status).toBe(200);
      expect(resOwn.body.data.verification.requestId).toBe(testRequestId);

      // Attempt to view Owner 2's request
      const resOther = await request(app)
        .get(`/api/verifications/${owner2RequestId}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(resOther.status).toBe(404);
    });
  });

  describe('4. Admin Review: SUBMITTED → UNDER_REVIEW', () => {
    it('OWNER and INSPECTOR cannot review verification requests (403 Forbidden)', async () => {
      const [resOwner, resInsp] = await Promise.all([
        request(app)
          .patch(`/api/verifications/${testRequestId}/review`)
          .set('Authorization', `Bearer ${owner1Token}`)
          .send({ reviewRemarks: 'Owner attempt' }),
        request(app)
          .patch(`/api/verifications/${testRequestId}/review`)
          .set('Authorization', `Bearer ${inspector1Token}`)
          .send({ reviewRemarks: 'Inspector attempt' })
      ]);

      expect(resOwner.status).toBe(403);
      expect(resInsp.status).toBe(403);
    });

    it('ADMIN reviews request: transitions status from SUBMITTED to UNDER_REVIEW and appends statusHistory', async () => {
      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewRemarks: 'Application documents and location verified' });

      expect(res.status).toBe(200);
      const vrf = res.body.data.verification;
      expect(vrf.status).toBe('UNDER_REVIEW');
      expect(vrf.reviewedBy.toString()).toBe(adminId);
      expect(vrf.reviewedAt).toBeDefined();
      expect(vrf.reviewRemarks).toBe('Application documents and location verified');

      // Verify statusHistory has 2 events
      expect(vrf.statusHistory).toHaveLength(2);
      expect(vrf.statusHistory[1].status).toBe('UNDER_REVIEW');
      expect(vrf.statusHistory[1].changedBy.toString()).toBe(adminId);
    });

    it('Rejects review if request is already UNDER_REVIEW (invalid state transition)', async () => {
      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewRemarks: 'Second review attempt' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid state transition');
    });
  });

  describe('5. Inspector Assignment: UNDER_REVIEW → ASSIGNED', () => {
    it('Rejects assignment to non-existent, inactive, or non-inspector user (400 Bad Request)', async () => {
      // 1. Non-existent user
      const resNonExistent = await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: new mongoose.Types.ObjectId().toString() });
      expect(resNonExistent.status).toBe(400);

      // 2. User with role OWNER instead of INSPECTOR
      const resOwnerRole = await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: owner1Id });
      expect(resOwnerRole.status).toBe(400);
      expect(resOwnerRole.body.message).toContain('INSPECTOR role');
    });

    it('ADMIN assigns active inspector: transitions status to ASSIGNED and appends statusHistory', async () => {
      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inspectorId: inspector1Id,
          remarks: 'Assigned to Inspector One for field verification'
        });

      expect(res.status).toBe(200);
      const vrf = res.body.data.verification;
      expect(vrf.status).toBe('ASSIGNED');
      expect(vrf.assignedInspector.toString()).toBe(inspector1Id);
      expect(vrf.assignedBy.toString()).toBe(adminId);
      expect(vrf.assignedAt).toBeDefined();

      expect(vrf.statusHistory).toHaveLength(3);
      expect(vrf.statusHistory[2].status).toBe('ASSIGNED');
    });

    it('Reassignment: records previousInspector and newInspector in metadata, while no-op reassignment creates no history', async () => {
      // 1. Reassign genuinely from inspector 1 to inspector 2
      const resReassign = await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          inspectorId: inspector2Id,
          remarks: 'Reassigned to Inspector Two'
        });

      expect(resReassign.status).toBe(200);
      const vrf = resReassign.body.data.verification;
      expect(vrf.assignedInspector.toString()).toBe(inspector2Id);
      expect(vrf.statusHistory).toHaveLength(4);

      const lastHistory = vrf.statusHistory[3];
      expect(lastHistory.metadata.previousInspector.toString()).toBe(inspector1Id);
      expect(lastHistory.metadata.newInspector.toString()).toBe(inspector2Id);

      // 2. No-op reassignment: assigning same inspector 2 again
      const resNoOp = await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: inspector2Id });

      expect(resNoOp.status).toBe(200);
      expect(resNoOp.body.data.verification.statusHistory).toHaveLength(4);

      // Reassign back to inspector 1 so downstream scheduling tests continue cleanly
      await request(app)
        .patch(`/api/verifications/${testRequestId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: inspector1Id });
    });

    it('Assigned inspector can now see the request in their listing', async () => {
      const res = await request(app)
        .get('/api/verifications')
        .set('Authorization', `Bearer ${inspector1Token}`);

      expect(res.status).toBe(200);
      const assignedIds = res.body.data.map((r: any) => r.requestId);
      expect(assignedIds).toContain(testRequestId);
    });

    it('Unassigned inspector cannot view or access this request (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/verifications/${testRequestId}`)
        .set('Authorization', `Bearer ${inspector2Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('6. Manual Scheduling & Conflict Prevention', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    futureDate.setMinutes(0, 0, 0);

    it('Rejects scheduling with past date or invalid duration (400 Bad Request)', async () => {
      // Past date
      const resPast = await request(app)
        .patch(`/api/verifications/${testRequestId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: new Date(Date.now() - 10000).toISOString(),
          estimatedDurationMinutes: 60
        });
      expect(resPast.status).toBe(400);
      expect(resPast.body.message).toContain('future date');

      // Focused Duration Validations: Fractional, Zero, Negative, and Over-Limit
      const durationTests = [
        { val: 30.5, label: 'fractional duration' },
        { val: 0, label: 'zero duration' },
        { val: -15, label: 'negative duration' },
        { val: 500, label: 'over-limit duration' }
      ];

      for (const testCase of durationTests) {
        const res = await request(app)
          .patch(`/api/verifications/${testRequestId}/schedule`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            scheduledAt: futureDate.toISOString(),
            estimatedDurationMinutes: testCase.val
          });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('estimatedDurationMinutes');
      }
    });

    it('ADMIN schedules verification: transitions ASSIGNED → SCHEDULED and appends statusHistory', async () => {
      const vrfBefore = await VerificationRequest.findOne({ requestId: testRequestId });
      const historyLengthBefore = vrfBefore?.statusHistory.length || 0;

      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: futureDate.toISOString(),
          estimatedDurationMinutes: 90,
          scheduleLocation: '100 Mount Rd, Chennai',
          scheduleNotes: 'Carry standard 20kg M1 weights'
        });

      expect(res.status).toBe(200);
      const vrf = res.body.data.verification;
      expect(vrf.status).toBe('SCHEDULED');
      expect(new Date(vrf.scheduledAt).toISOString()).toBe(futureDate.toISOString());
      expect(vrf.estimatedDurationMinutes).toBe(90);
      expect(vrf.scheduleNotes).toBe('Carry standard 20kg M1 weights');

      expect(vrf.statusHistory).toHaveLength(historyLengthBefore + 1);
      expect(vrf.statusHistory[vrf.statusHistory.length - 1].status).toBe('SCHEDULED');
    });

    it('No-op reschedule: sending identical schedule values does not append duplicate history', async () => {
      const vrfBefore = await VerificationRequest.findOne({ requestId: testRequestId });
      const historyLengthBefore = vrfBefore?.statusHistory.length || 0;

      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: futureDate.toISOString(),
          estimatedDurationMinutes: 90,
          scheduleLocation: '100 Mount Rd, Chennai',
          scheduleNotes: 'Carry standard 20kg M1 weights'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.verification.statusHistory).toHaveLength(historyLengthBefore);
    });

    it('Conflict prevention: rejects overlapping schedule for the same inspector (409 Conflict)', async () => {
      // Create a 2nd verification request for Owner 1 on a fresh instrument
      const inst3 = new Instrument({
        instrumentId: `WM-CHE-${Math.floor(10000 + Math.random() * 90000)}`,
        owner: new mongoose.Types.ObjectId(owner1Id),
        type: 'WEIGHING_SCALE',
        category: 'NON_AUTOMATIC_WEIGHING',
        manufacturer: 'Mettler',
        model: 'XP',
        serialNumber: `SN-P4-CONFLICT-${Date.now()}`,
        capacity: { value: 20, unit: 'kg' },
        location: {
          address: '200 Mount Rd',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600002',
          coordinates: { type: 'Point', coordinates: [80.27, 13.08] }
        },
        status: 'REGISTERED',
        lifecycleHistory: [],
        isArchived: false,
        createdBy: new mongoose.Types.ObjectId(owner1Id),
        updatedBy: new mongoose.Types.ObjectId(owner1Id)
      });
      await inst3.save();
      createdInstrumentIds.push(inst3._id as mongoose.Types.ObjectId);

      const resCreate = await request(app)
        .post('/api/verifications')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          instrumentId: inst3.instrumentId,
          verificationType: 'INITIAL'
        });
      const req2Id = resCreate.body.data.verification.requestId;
      createdVerificationIds.push(new mongoose.Types.ObjectId(resCreate.body.data.verification._id));

      // Review and Assign to inspector 1
      await request(app)
        .patch(`/api/verifications/${req2Id}/review`)
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .patch(`/api/verifications/${req2Id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: inspector1Id });

      // Attempt to schedule at overlapping time window (30 mins after futureDate, duration 60 mins -> overlaps with [0, 90])
      const overlapDate = new Date(futureDate.getTime() + 30 * 60 * 1000);
      const resConflict = await request(app)
        .patch(`/api/verifications/${req2Id}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: overlapDate.toISOString(),
          estimatedDurationMinutes: 60
        });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.message).toContain('conflicting schedule');

      // Scheduling with inspector 2 at the same time succeeds without conflict
      await request(app)
        .patch(`/api/verifications/${req2Id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ inspectorId: inspector2Id });

      const resDifferentInspector = await request(app)
        .patch(`/api/verifications/${req2Id}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: overlapDate.toISOString(),
          estimatedDurationMinutes: 60
        });

      expect(resDifferentInspector.status).toBe(200);
      expect(resDifferentInspector.body.data.verification.status).toBe('SCHEDULED');
    });

    it('Rescheduling: allows changing appointment time when new window has no conflicts', async () => {
      const rescheduleDate = new Date(futureDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

      // Capture current history length before rescheduling (dynamic, accounts for prior test steps)
      const vrfBefore = await VerificationRequest.findOne({ requestId: testRequestId });
      const historyLengthBefore = vrfBefore?.statusHistory.length || 0;

      const res = await request(app)
        .patch(`/api/verifications/${testRequestId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: rescheduleDate.toISOString(),
          estimatedDurationMinutes: 60,
          scheduleNotes: 'Rescheduled appointment'
        });

      expect(res.status).toBe(200);
      const vrf = res.body.data.verification;
      expect(new Date(vrf.scheduledAt).toISOString()).toBe(rescheduleDate.toISOString());
      expect(vrf.statusHistory).toHaveLength(historyLengthBefore + 1);
      const lastEntry = vrf.statusHistory[vrf.statusHistory.length - 1];
      expect(lastEntry.metadata.isReschedule).toBe(true);
    });

    it('Physical DELETE endpoint does not exist (404 Not Found)', async () => {
      const res = await request(app)
        .delete(`/api/verifications/${testRequestId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('7. Request ID Concurrency & Format', () => {
    it('concurrently generates unique sequential request IDs in VRF-YYYY-00000 format without duplicates', async () => {
      const count = 10;
      const ids = await Promise.all(
        Array.from({ length: count }, () => generateVerificationRequestId())
      );

      expect(ids).toHaveLength(count);

      const currentYear = new Date().getFullYear();
      for (const id of ids) {
        expect(id).toMatch(new RegExp(`^VRF-${currentYear}-\\d{5}$`));
      }

      // Check all 10 are completely unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(count);
    });
  });
});
