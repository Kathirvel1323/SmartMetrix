import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/user.model';
import { Instrument } from '../src/models/instrument.model';
import { VerificationRequest } from '../src/models/verification-request.model';
import { Inspection } from '../src/models/inspection.model';
import { Notification } from '../src/models/notification.model';
import { DemoBatch } from '../src/models/demo-batch.model';
import { analyticsService } from '../src/services/analytics.service';
import { notificationService } from '../src/services/notification.service';
import { demoDataService } from '../src/services/demo-data.service';
import { AiServiceClient } from '../src/services/ai-client.service';
import { getCertificateIntegritySecret, getComplaintEncryptionKey } from '../src/utils/crypto-seal.utils';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(`SAFETY GUARD ABORT: Test operations restricted to 'smartmetrix_test'. Connected to '${currentDbName}'.`);
  }
};

describe('SmartMetrix Critical Blockers Regression Tests', () => {
  let owner1: any;
  let owner2: any;
  let inspector1: any;
  let inspector2: any;
  let admin: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || 'test_ai_service_secret_token_min_32_chars';
    process.env.CERTIFICATE_INTEGRITY_SECRET = process.env.CERTIFICATE_INTEGRITY_SECRET || 'test_cert_integrity_secret_min_32_characters_12345';
    process.env.COMPLAINT_ENCRYPTION_KEY = process.env.COMPLAINT_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
    assertTestDatabaseSafety();

    try {
      await Notification.collection.dropIndex('fingerprint_1');
    } catch {}
    await Notification.syncIndexes();

    // Clean up test documents
    await User.deleteMany({ email: { $regex: /@blockers\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-BLK-/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-BLK-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INS-BLK-/ } });
    await Notification.deleteMany({ fingerprint: { $regex: /^blk-fp-/ } });
    await DemoBatch.deleteMany({ seed: { $regex: /^blk-seed/ } });

    // Seed users
    admin = await User.create({
      name: 'Blocker Admin',
      email: 'admin@blockers.smartmetrix.test',
      password: 'Password123!',
      role: 'ADMIN'
    });

    owner1 = await User.create({
      name: 'Blocker Owner 1',
      email: 'owner1@blockers.smartmetrix.test',
      password: 'Password123!',
      role: 'OWNER'
    });

    owner2 = await User.create({
      name: 'Blocker Owner 2',
      email: 'owner2@blockers.smartmetrix.test',
      password: 'Password123!',
      role: 'OWNER'
    });

    inspector1 = await User.create({
      name: 'Blocker Inspector 1',
      email: 'insp1@blockers.smartmetrix.test',
      password: 'Password123!',
      role: 'INSPECTOR'
    });

    inspector2 = await User.create({
      name: 'Blocker Inspector 2',
      email: 'insp2@blockers.smartmetrix.test',
      password: 'Password123!',
      role: 'INSPECTOR'
    });
  });

  afterAll(async () => {
    assertTestDatabaseSafety();
    await User.deleteMany({ email: { $regex: /@blockers\.smartmetrix\.test$/ } });
    await Instrument.deleteMany({ serialNumber: { $regex: /^SN-BLK-/ } });
    await VerificationRequest.deleteMany({ requestId: { $regex: /^VRF-BLK-/ } });
    await Inspection.deleteMany({ inspectionId: { $regex: /^INS-BLK-/ } });
    await Notification.deleteMany({ fingerprint: { $regex: /^blk-fp-/ } });
    await DemoBatch.deleteMany({ seed: { $regex: /^blk-seed/ } });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ===========================================================================
  // 1. Secret Validation & Absence of Hardcoded Fallbacks
  // ===========================================================================
  describe('1. Secret Validation & No Fallback Defaults', () => {
    it('should throw error when AI_SERVICE_TOKEN is missing', () => {
      const origToken = process.env.AI_SERVICE_TOKEN;
      delete process.env.AI_SERVICE_TOKEN;

      const client = new AiServiceClient();
      expect(() => (client as any).serviceToken).toThrow(/AI_SERVICE_TOKEN is not configured/i);

      process.env.AI_SERVICE_TOKEN = origToken;
    });

    it('should throw error when CERTIFICATE_INTEGRITY_SECRET is missing or too short', () => {
      const origSecret = process.env.CERTIFICATE_INTEGRITY_SECRET;
      delete process.env.CERTIFICATE_INTEGRITY_SECRET;

      expect(() => getCertificateIntegritySecret()).toThrow(/CERTIFICATE_INTEGRITY_SECRET must be configured/i);

      process.env.CERTIFICATE_INTEGRITY_SECRET = 'short';
      expect(() => getCertificateIntegritySecret()).toThrow(/at least 32 characters/i);

      process.env.CERTIFICATE_INTEGRITY_SECRET = origSecret;
    });

    it('should throw error when COMPLAINT_ENCRYPTION_KEY is missing or invalid length', () => {
      const origKey = process.env.COMPLAINT_ENCRYPTION_KEY;
      delete process.env.COMPLAINT_ENCRYPTION_KEY;

      expect(() => getComplaintEncryptionKey()).toThrow(/COMPLAINT_ENCRYPTION_KEY is not configured/i);

      process.env.COMPLAINT_ENCRYPTION_KEY = 'invalid_length_key';
      expect(() => getComplaintEncryptionKey()).toThrow(/exactly 32 bytes/i);

      process.env.COMPLAINT_ENCRYPTION_KEY = origKey;
    });
  });

  // ===========================================================================
  // 2. Analytics RBAC & Field Mappings Isolation
  // ===========================================================================
  describe('2. Analytics RBAC & Scope Isolation', () => {
    let instOwner1: any;
    let instOwner2: any;
    let vrfInsp1: any;
    let vrfInsp2: any;

    beforeAll(async () => {
      instOwner1 = await Instrument.create({
        instrumentId: 'INST-BLK-O1',
        serialNumber: 'SN-BLK-O1',
        type: 'WEIGHING_SCALE',
        category: 'WEIGHING_SCALE',
        manufacturer: 'Metrix',
        model: 'M1',
        capacity: { value: 10, unit: 'kg' },
        location: { address: 'A', city: 'Chennai', district: 'Chennai', state: 'TN', pincode: '600001', coordinates: { type: 'Point', coordinates: [80.27, 13.08] } },
        owner: owner1._id,
        ownerId: owner1._id.toString(),
        createdBy: owner1._id,
        updatedBy: owner1._id
      });

      instOwner2 = await Instrument.create({
        instrumentId: 'INST-BLK-O2',
        serialNumber: 'SN-BLK-O2',
        type: 'FUEL_DISPENSER',
        category: 'FUEL_DISPENSER',
        manufacturer: 'Metrix',
        model: 'F1',
        capacity: { value: 50, unit: 'kg' },
        location: { address: 'B', city: 'Madurai', district: 'Madurai', state: 'TN', pincode: '625001', coordinates: { type: 'Point', coordinates: [78.11, 9.92] } },
        owner: owner2._id,
        ownerId: owner2._id.toString(),
        createdBy: owner2._id,
        updatedBy: owner2._id
      });

      vrfInsp1 = await VerificationRequest.create({
        requestId: 'VRF-BLK-1',
        instrument: instOwner1._id,
        instrumentId: instOwner1.instrumentId,
        owner: owner1._id,
        ownerId: owner1._id.toString(),
        assignedInspector: inspector1._id,
        assignedInspectorId: inspector1._id.toString(),
        verificationType: 'INITIAL',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        createdBy: owner1._id,
        updatedBy: owner1._id
      });

      vrfInsp2 = await VerificationRequest.create({
        requestId: 'VRF-BLK-2',
        instrument: instOwner2._id,
        instrumentId: instOwner2.instrumentId,
        owner: owner2._id,
        ownerId: owner2._id.toString(),
        assignedInspector: inspector2._id,
        assignedInspectorId: inspector2._id.toString(),
        verificationType: 'INITIAL',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        createdBy: owner2._id,
        updatedBy: owner2._id
      });
    });

    it('should scope OWNER analytics strictly to owned instruments and verification requests', async () => {
      const owner1Kpis = await analyticsService.getDashboardKpis({ id: owner1._id.toString(), role: 'OWNER' }, {});
      expect(owner1Kpis.kpis.totalInstruments).toBe(1);
      expect(owner1Kpis.kpis.pendingVerifications).toBe(1);

      const owner2Kpis = await analyticsService.getDashboardKpis({ id: owner2._id.toString(), role: 'OWNER' }, {});
      expect(owner2Kpis.kpis.totalInstruments).toBe(1);
      expect(owner2Kpis.kpis.pendingVerifications).toBe(1);
    });

    it('should scope INSPECTOR analytics strictly to assigned work without cross-scope leakage', async () => {
      const insp1Kpis = await analyticsService.getDashboardKpis({ id: inspector1._id.toString(), role: 'INSPECTOR' }, {});
      expect(insp1Kpis.kpis.totalInstruments).toBe(1);
      expect(insp1Kpis.kpis.pendingVerifications).toBe(1);

      const insp2Kpis = await analyticsService.getDashboardKpis({ id: inspector2._id.toString(), role: 'INSPECTOR' }, {});
      expect(insp2Kpis.kpis.totalInstruments).toBe(1);
      expect(insp2Kpis.kpis.pendingVerifications).toBe(1);
    });
  });

  // ===========================================================================
  // 3. Per-User Notification Ownership & Read Isolation
  // ===========================================================================
  describe('3. Per-User Notification Read Isolation', () => {
    it('should isolate notification read status per user so one user marking read does not affect another', async () => {
      const fp = `blk-fp-${Date.now()}`;
      const notif1 = await Notification.create({
        notificationId: `NOTIF-BLK-1-${Date.now()}`,
        recipient: owner1._id,
        recipientRole: 'OWNER',
        type: 'OPERATIONAL_BROADCAST',
        severity: 'INFO',
        title: 'Broadcast Title',
        message: 'Message content',
        isRead: false,
        fingerprint: fp
      });

      const notif2 = await Notification.create({
        notificationId: `NOTIF-BLK-2-${Date.now()}`,
        recipient: owner2._id,
        recipientRole: 'OWNER',
        type: 'OPERATIONAL_BROADCAST',
        severity: 'INFO',
        title: 'Broadcast Title',
        message: 'Message content',
        isRead: false,
        fingerprint: fp
      });

      // Owner 1 marks their notification as read
      await notificationService.markAsRead({ id: owner1._id.toString(), role: 'OWNER' }, notif1.notificationId);

      const check1 = await Notification.findOne({ notificationId: notif1.notificationId });
      const check2 = await Notification.findOne({ notificationId: notif2.notificationId });

      expect(check1?.isRead).toBe(true);
      expect(check2?.isRead).toBe(false); // Owner 2 notification remains UNREAD
    });

    it('should disallow User A from marking User B notification as read', async () => {
      const notifUser2 = await Notification.create({
        notificationId: `NOTIF-BLK-ISO-${Date.now()}`,
        recipient: owner2._id,
        recipientRole: 'OWNER',
        type: 'OPERATIONAL_BROADCAST',
        severity: 'INFO',
        title: 'Iso Title',
        message: 'Iso content',
        isRead: false,
        fingerprint: `blk-fp-iso-${Date.now()}`
      });

      await expect(
        notificationService.markAsRead({ id: owner1._id.toString(), role: 'OWNER' }, notifUser2.notificationId)
      ).rejects.toThrow(/not found or access forbidden/i);
    });
  });

  // ===========================================================================
  // 4. DemoBatch Idempotency & Record Recovery
  // ===========================================================================
  describe('4. DemoBatch Idempotency & Record Recovery', () => {
    it('should return identical batch on duplicate idempotencyKey call and track created record IDs', async () => {
      const seed = `blk-seed-${Date.now()}`;
      const idempotencyKey = `idemp-blk-${Date.now()}`;

      const batch1 = await demoDataService.generateDemoData(admin, { count: 10, seed, idempotencyKey });
      expect(['COMPLETED', 'PARTIAL_FAILURE']).toContain(batch1.status);
      expect(batch1.idempotencyKey).toBe(idempotencyKey);
      expect(batch1.createdRecordIds?.instruments?.length).toBe(10);

      // Concurrent / repeat attempt with exact same idempotencyKey
      const batch2 = await demoDataService.generateDemoData(admin, { count: 10, seed, idempotencyKey });
      expect(batch2.batchId).toBe(batch1.batchId);
      expect(batch2.createdRecordIds?.instruments?.length).toBe(10);
    });
  });
});
