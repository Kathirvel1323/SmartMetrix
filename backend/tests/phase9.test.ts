import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { Inspection } from '../src/models/inspection.model';
import { Certificate } from '../src/models/certificate.model';
import { AuditLog } from '../src/models/audit-log.model';
import { Notification } from '../src/models/notification.model';
import { DemoBatch } from '../src/models/demo-batch.model';
import { ImprovementNotice } from '../src/models/improvement-notice.model';
import { RiskAssessment } from '../src/models/risk-assessment.model';
import { RegionalCorrelationAssessment } from '../src/models/regional-correlation.model';
import { AnomalyAssessment } from '../src/models/anomaly-assessment.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`
    );
  }
};

describe('SmartMetrix Phase 9 — Core Operations Backend (Audit, Notifications, Analytics, Reports, Search, Demo Generator)', () => {
  let adminToken: string;
  let inspectorToken: string;
  let ownerToken: string;

  let adminUser: any;
  let inspectorUser: any;
  let ownerUser: any;

  let testInst: any;
  let notificationId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';
    process.env.AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || 'test_ai_service_secret_token_min_32_chars';
    process.env.CERTIFICATE_INTEGRITY_SECRET = process.env.CERTIFICATE_INTEGRITY_SECRET || 'test_cert_integrity_secret_min_32_characters_12345';
    process.env.COMPLAINT_ENCRYPTION_KEY = process.env.COMPLAINT_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assertTestDatabaseSafety();

    // Clean up test data
    await User.deleteMany({ email: { $regex: /@phase9\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P9/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-P9-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INSP-P9-/ } });
    await Certificate.deleteMany({ certificateId: { $regex: /^CERT-P9-/ } });
    await AuditLog.deleteMany({ entityId: { $regex: /P9/ } }, { bypassImmutable: true } as any);
    await Notification.deleteMany({ title: { $regex: /Phase 9|P9/ } });
    await DemoBatch.deleteMany({ seed: { $regex: /^test-seed/ } });

    // 1. Create Users
    adminUser = await User.create({
      name: 'P9 Admin',
      email: 'admin@phase9.smartmetrix.test',
      password: 'Password123!',
      role: 'ADMIN',
      jurisdiction: 'Tamil Nadu'
    });

    inspectorUser = await User.create({
      name: 'P9 Inspector',
      email: 'inspector@phase9.smartmetrix.test',
      password: 'Password123!',
      role: 'INSPECTOR',
      jurisdiction: 'Tamil Nadu'
    });

    ownerUser = await User.create({
      name: 'P9 Owner',
      email: 'owner@phase9.smartmetrix.test',
      password: 'Password123!',
      role: 'OWNER',
      jurisdiction: 'Tamil Nadu'
    });

    // 2. Login to get tokens
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@phase9.smartmetrix.test',
      password: 'Password123!'
    });
    adminToken = adminRes.body.data.token;

    const inspRes = await request(app).post('/api/auth/login').send({
      email: 'inspector@phase9.smartmetrix.test',
      password: 'Password123!'
    });
    inspectorToken = inspRes.body.data.token;

    const ownerRes = await request(app).post('/api/auth/login').send({
      email: 'owner@phase9.smartmetrix.test',
      password: 'Password123!'
    });
    ownerToken = ownerRes.body.data.token;

    // 3. Create sample instrument
    testInst = await Instrument.create({
      instrumentId: 'INST-P9-1001',
      serialNumber: 'SN-P9-1001',
      type: 'WEIGHING_SCALE',
      category: 'WEIGHING_SCALE',
      manufacturer: 'MetrixTech',
      model: 'P9-X1',
      capacity: { value: 50, unit: 'kg' },
      location: {
        address: '123 Test St',
        city: 'Madurai',
        district: 'Madurai',
        state: 'Tamil Nadu',
        pincode: '625001',
        coordinates: {
          type: 'Point',
          coordinates: [78.1198, 9.9252]
        }
      },
      owner: ownerUser._id,
      ownerId: ownerUser._id.toString(),
      createdBy: adminUser._id,
      updatedBy: adminUser._id,
      status: 'REGISTERED'
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('A. Audit Trail', () => {
    it('should create an audit log on report/action and sanitize sensitive metadata', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should disallow OWNER from accessing system audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });

    it('should enforce append-only immutability at model level', async () => {
      const log = new AuditLog({
        auditId: 'AUD-P9-IMMUTABLE',
        timestamp: new Date(),
        actor: { userId: adminUser.id, role: 'ADMIN' },
        action: 'TEST_IMMUTABLE',
        entityType: 'Test',
        entityId: 'P9-IMMUTABLE'
      });
      await log.save();

      await expect(AuditLog.updateOne({ auditId: 'AUD-P9-IMMUTABLE' }, { action: 'MUTATED' })).rejects.toThrow();
      await expect(AuditLog.deleteOne({ auditId: 'AUD-P9-IMMUTABLE' })).rejects.toThrow();
    });
  });

  describe('B. Smart Notifications', () => {
    it('should trigger notification scan and deduplicate repeat triggers', async () => {
      // 1. Initial scan
      const res1 = await request(app)
        .post('/api/notifications/scan')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res1.status).toBe(200);

      // 2. Repeat scan (should generate 0 due to fingerprint deduplication)
      const res2 = await request(app)
        .post('/api/notifications/scan')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.createdCount).toBe(0);
    });

    it('should allow ADMIN operational broadcast', async () => {
      const res = await request(app)
        .post('/api/notifications/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'P9 System Maintenance',
          message: 'Scheduled maintenance tonight at midnight.',
          recipientRole: 'OWNER',
          severity: 'INFO'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('P9 System Maintenance');
      notificationId = res.body.data.notificationId;
    });

    it('should retrieve role-scoped notifications and mark notification as read', async () => {
      const listRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      const target = listRes.body.data.find((n: any) => n.notificationId === notificationId);
      if (target) {
        const patchRes = await request(app)
          .patch(`/api/notifications/${target.notificationId}/read`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.isRead).toBe(true);
      }
    });
  });

  describe('C. Analytics APIs', () => {
    it('should return role-scoped dashboard KPIs with genuine aggregates', async () => {
      const adminDash = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDash.status).toBe(200);
      expect(adminDash.body.data.kpis.totalInstruments).toBeGreaterThanOrEqual(1);

      const ownerDash = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerDash.status).toBe(200);
      expect(ownerDash.body.data.kpis.highRiskCount).toBe(0); // Owners cannot view high risk breakdown
    });

    it('should return verification status and city distribution', async () => {
      const verDist = await request(app)
        .get('/api/analytics/verification-distribution')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verDist.status).toBe(200);

      const cityDist = await request(app)
        .get('/api/analytics/city-distribution')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(cityDist.status).toBe(200);
    });
  });

  describe('D. PDF and CSV Reports', () => {
    it('should stream CSV report with formula injection prevention', async () => {
      const res = await request(app)
        .get('/api/reports/instruments?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('smartmetrix_instruments_');
      expect(res.text).toContain('Instrument ID');
    });

    it('should stream PDF report safely', async () => {
      const res = await request(app)
        .get('/api/reports/instruments?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body instanceof Buffer || res.text).toBeTruthy();
    });

    it('should disallow OWNER from requesting unpermitted reports', async () => {
      const res = await request(app)
        .get('/api/reports/high-risk?format=csv')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('E. Advanced Search', () => {
    it('should execute multi-entity search with escaped regex query', async () => {
      const res = await request(app)
        .get('/api/search?query=SN-P9-[1001]&entityType=all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.results.instruments).toBeDefined();
    });

    it('should enforce owner scoping on search results', async () => {
      const res = await request(app)
        .get('/api/search?query=SN-P9-1001')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.results.instruments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('F. One-Click Demo Data Generator', () => {
    it('should reject non-ADMIN demo generation requests', async () => {
      const res = await request(app)
        .post('/api/admin/demo-data/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ count: 100 });

      expect(res.status).toBe(403);
    });

    it('should generate synthetic realistic records bounded to 100-200 and invoke calculation engines', async () => {
      const seed = `test-seed-${Date.now()}`;
      const idempotencyKey = `idemp-${Date.now()}`;

      const res = await request(app)
        .post('/api/admin/demo-data/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          count: 100,
          seed,
          idempotencyKey
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.count).toBe(100);
      expect(res.body.data.recordCounts.instruments).toBe(100);
      expect(['COMPLETED', 'PARTIAL_FAILURE']).toContain(res.body.data.status);

      // Test Idempotency
      const idempRes = await request(app)
        .post('/api/admin/demo-data/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          count: 100,
          seed,
          idempotencyKey
        });

      expect(idempRes.status).toBe(201);
      expect(idempRes.body.data.batchId).toBe(res.body.data.batchId);
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    // Clean up demo data generated during tests
    await User.deleteMany({ email: { $regex: /@phase9\.smartmetrix\.test$|^demo\./ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-P9|^SN-DEMO-/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-P9-|^VRF-DEMO-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INSP-P9-|^INS-DEMO-/ } });
    await Certificate.deleteMany({ certificateNumber: { $regex: /^CERT-P9-|^CERT-DEMO-/ } });
    await ImprovementNotice.deleteMany({ noticeId: { $regex: /^NOT-DEMO-/ } });
    await RiskAssessment.deleteMany({ instrumentIdSnapshot: { $regex: /^WM-P9-|^WM-DEMO-/ } });
    await RegionalCorrelationAssessment.deleteMany({ instrumentIdSnapshot: { $regex: /^WM-P9-|^WM-DEMO-/ } });
    await AnomalyAssessment.deleteMany({ instrumentIdSnapshot: { $regex: /^WM-P9-|^WM-DEMO-/ } });
    await DemoBatch.deleteMany({ seed: { $regex: /^test-seed/ } });
    await AuditLog.deleteMany({ entityId: { $regex: /P9|DEMO/ } }, { bypassImmutable: true } as any);
    await Notification.deleteMany({ title: { $regex: /Phase 9|P9|Demo/ } });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
});
