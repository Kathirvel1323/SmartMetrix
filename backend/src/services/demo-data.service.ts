import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser } from '../models/user.model';
import { Instrument } from '../models/instrument.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Inspection } from '../models/inspection.model';
import { Certificate } from '../models/certificate.model';
import { Complaint } from '../models/complaint.model';
import { ImprovementNotice } from '../models/improvement-notice.model';
import { DemoBatch, IDemoBatch } from '../models/demo-batch.model';
import { riskService } from './risk.service';
import { regionalService } from './regional.service';
import { anomalyService } from './anomaly.service';
import { auditService } from './audit.service';
import { generateCertificateNumber, generateNoticeId } from '../utils/phase8-id.utils';
import { createIntegritySeal } from '../utils/crypto-seal.utils';

const CITIES: Record<string, [number, number]> = {
  Madurai: [78.1198, 9.9252],
  Salem: [78.146, 11.6643],
  Coimbatore: [76.9558, 11.0168],
  Tiruchirappalli: [78.7047, 10.7905],
  Chennai: [80.2707, 13.0827]
};

const CATEGORIES = ['WEIGHING_SCALE', 'FUEL_DISPENSER', 'FLOW_METER', 'WATER_METER', 'TAXIMETER'];
const MANUFACTURERS = ['MetrixTech', 'PrecisionScale', 'AeroFlow', 'ApexGauge', 'TamilMetrix'];

const pushUniqueId = (arr: mongoose.Types.ObjectId[] | undefined, id: mongoose.Types.ObjectId) => {
  if (!arr) return;
  const str = id.toString();
  if (!arr.some((existing) => existing.toString() === str)) {
    arr.push(id);
  }
};

export class DemoDataService {
  private pseudoRandom(seedStr: string): () => number {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    return () => {
      hash = (hash * 9301 + 49297) % 233280;
      return hash / 233280;
    };
  }

  async generateDemoData(
    adminUser: IUser,
    options: { count?: number; seed?: string; idempotencyKey?: string }
  ): Promise<IDemoBatch> {
    const rawCount = Number(options.count) || 100;
    const count = Math.min(200, Math.max(10, rawCount));
    const seed = options.seed || `seed-${Date.now()}`;
    const idempotencyKey = options.idempotencyKey || `idemp-${seed}`;

    let batch = await DemoBatch.findOne({ idempotencyKey });
    if (batch) {
      if (batch.status === 'COMPLETED') {
        return batch;
      }
    } else {
      const batchId = `BATCH-${uuidv4().substring(0, 8).toUpperCase()}`;
      try {
        batch = new DemoBatch({
          batchId,
          idempotencyKey,
          seed,
          count,
          status: 'PENDING',
          recordCounts: {
            users: 0,
            instruments: 0,
            verificationRequests: 0,
            inspections: 0,
            certificates: 0,
            complaints: 0,
            improvementNotices: 0
          },
          createdRecordIds: {
            users: [],
            instruments: [],
            verificationRequests: [],
            inspections: [],
            certificates: [],
            complaints: [],
            improvementNotices: []
          }
        });
        await batch.save();
      } catch (err: any) {
        if (err.code === 11000) {
          const existing = await DemoBatch.findOne({ idempotencyKey });
          if (existing) return existing;
        }
        throw err;
      }
    }

    batch.status = 'IN_PROGRESS';
    await batch.save();

    const batchId = batch.batchId;
    const random = this.pseudoRandom(seed);
    const demoPassword = process.env.DEMO_DATA_PASSWORD || 'DemoSecretPassword2026!';
    let partialErrors: string[] = [];

    try {
      if (!batch.createdRecordIds) {
        batch.createdRecordIds = {
          users: [],
          instruments: [],
          verificationRequests: [],
          inspections: [],
          certificates: [],
          complaints: [],
          improvementNotices: []
        };
      }

      // 1. Create Synthetic Demo Users (2 Owners, 1 Inspector)
      const owner1Email = `demo.owner1.${batchId.toLowerCase()}@smartmetrix.test`;
      const owner2Email = `demo.owner2.${batchId.toLowerCase()}@smartmetrix.test`;
      const inspectorEmail = `demo.inspector.${batchId.toLowerCase()}@smartmetrix.test`;

      let demoOwner1 = await User.findOne({ email: owner1Email });
      if (!demoOwner1) {
        demoOwner1 = await User.create({
          name: 'Tamil Traders Demo Owner 1',
          email: owner1Email,
          password: demoPassword,
          role: 'OWNER'
        });
        pushUniqueId(batch.createdRecordIds.users, demoOwner1._id as mongoose.Types.ObjectId);
      } else {
        pushUniqueId(batch.createdRecordIds.users, demoOwner1._id as mongoose.Types.ObjectId);
      }

      let demoOwner2 = await User.findOne({ email: owner2Email });
      if (!demoOwner2) {
        demoOwner2 = await User.create({
          name: 'Coimbatore Scale Works Owner 2',
          email: owner2Email,
          password: demoPassword,
          role: 'OWNER'
        });
        pushUniqueId(batch.createdRecordIds.users, demoOwner2._id as mongoose.Types.ObjectId);
      } else {
        pushUniqueId(batch.createdRecordIds.users, demoOwner2._id as mongoose.Types.ObjectId);
      }

      let demoInspector = await User.findOne({ email: inspectorEmail });
      if (!demoInspector) {
        demoInspector = await User.create({
          name: 'Authorized Inspector Demo',
          email: inspectorEmail,
          password: demoPassword,
          role: 'INSPECTOR'
        });
        pushUniqueId(batch.createdRecordIds.users, demoInspector._id as mongoose.Types.ObjectId);
      } else {
        pushUniqueId(batch.createdRecordIds.users, demoInspector._id as mongoose.Types.ObjectId);
      }

      batch.recordCounts.users = batch.createdRecordIds.users?.length || 3;

      const owners = [demoOwner1, demoOwner2];
      const cityKeys = Object.keys(CITIES);

      // 2. Generate Instruments
      const createdInstruments = [];
      for (let i = 0; i < count; i++) {
        const city = cityKeys[i % cityKeys.length] || 'Chennai';
        const [baseLon, baseLat] = CITIES[city] || [80.2707, 13.0827];
        const lon = baseLon + (random() - 0.5) * 0.1;
        const lat = baseLat + (random() - 0.5) * 0.1;
        const category = CATEGORIES[Math.floor(random() * CATEGORIES.length) % CATEGORIES.length] || 'WEIGHING_SCALE';
        const manufacturer = MANUFACTURERS[Math.floor(random() * MANUFACTURERS.length) % MANUFACTURERS.length] || 'MetrixTech';
        const owner = owners[i % 2];
        const instId = `INST-DEMO-${batchId.substring(6)}-${(i + 1).toString().padStart(4, '0')}`;

        let inst = await Instrument.findOne({ instrumentId: instId });
        if (!inst) {
          inst = await Instrument.create({
            instrumentId: instId,
            serialNumber: `SN-DEMO-${Math.floor(random() * 899999 + 100000)}`,
            type: category,
            category,
            manufacturer,
            model: `Model-${category.substring(0, 3)}-${Math.floor(random() * 90 + 10)}`,
            capacity: { value: 100, unit: 'kg' },
            location: {
              address: `No. ${i + 1}, Industrial Estate, ${city}`,
              city,
              district: city,
              state: 'Tamil Nadu',
              pincode: '600001',
              coordinates: { type: 'Point', coordinates: [lon, lat] }
            },
            owner: owner._id,
            ownerId: owner._id.toString(),
            createdBy: adminUser._id,
            updatedBy: adminUser._id,
            status: 'REGISTERED'
          });
          pushUniqueId(batch.createdRecordIds.instruments, inst._id as mongoose.Types.ObjectId);
        } else {
          pushUniqueId(batch.createdRecordIds.instruments, inst._id as mongoose.Types.ObjectId);
        }

        createdInstruments.push(inst);
      }
      batch.recordCounts.instruments = createdInstruments.length;
      await batch.save();

      // 3. Generate Verification Requests & Inspections for all instruments
      for (let i = 0; i < createdInstruments.length; i++) {
        const inst = createdInstruments[i];
        const ownerId = inst.owner.toString();
        const isPass = random() > 0.15; // 85% pass rate
        const reqId = `VER-DEMO-${batchId.substring(6)}-${(i + 1).toString().padStart(4, '0')}`;
        const inspId = `INSP-DEMO-${batchId.substring(6)}-${(i + 1).toString().padStart(4, '0')}`;

        let ver = await VerificationRequest.findOne({ requestId: reqId });
        if (!ver) {
          ver = await VerificationRequest.create({
            requestId: reqId,
            instrument: inst._id,
            instrumentId: inst.instrumentId,
            owner: inst.owner,
            ownerId: ownerId,
            assignedInspector: demoInspector._id,
            assignedInspectorId: demoInspector._id.toString(),
            verificationType: 'INITIAL',
            status: isPass ? 'CERTIFICATE_ISSUED' : 'FAILED',
            scheduledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            submittedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
            createdBy: inst.owner,
            updatedBy: inst.owner
          });
          pushUniqueId(batch.createdRecordIds.verificationRequests, ver._id as mongoose.Types.ObjectId);
        } else {
          pushUniqueId(batch.createdRecordIds.verificationRequests, ver._id as mongoose.Types.ObjectId);
        }

        const deviation = isPass ? (random() - 0.5) * 0.2 : (random() > 0.5 ? 2.5 : -2.5);
        const refReading = 100;
        const obsReading = refReading + deviation;
        const devPct = (deviation / refReading) * 100;

        let insp = await Inspection.findOne({ inspectionId: inspId });
        if (!insp) {
          insp = await Inspection.create({
            inspectionId: inspId,
            verificationRequest: ver._id,
            requestId: ver.requestId,
            instrument: inst._id,
            instrumentId: inst.instrumentId,
            instrumentIdSnapshot: inst.instrumentId,
            inspector: demoInspector._id,
            inspectorId: demoInspector._id.toString(),
            ownerId: ownerId,
            inspectionDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
            status: 'FINALIZED',
            overallResult: isPass ? 'PASS' : 'FAIL',
            inspectorResult: isPass ? 'PASS' : 'FAIL',
            calculatedAssessment: isPass ? 'WITHIN_TOLERANCE' : 'OUTSIDE_TOLERANCE',
            referenceReading: refReading,
            actualReading: obsReading,
            observedReading: obsReading,
            deviation,
            deviationPercentage: devPct,
            maxAllowableTolerance: 1.0,
            toleranceSnapshot: {
              ruleId: 'TOL-DEMO-01',
              name: 'Standard Legal Metrology Tolerance',
              toleranceMode: 'ABSOLUTE',
              toleranceValue: 1.0,
              capacityUnit: 'kg'
            },
            serialNumberMatch: true,
            sealStatus: isPass ? 'INTACT' : 'TAMPERED',
            createdBy: demoInspector._id,
            updatedBy: demoInspector._id
          });
          pushUniqueId(batch.createdRecordIds.inspections, insp._id as mongoose.Types.ObjectId);
        } else {
          pushUniqueId(batch.createdRecordIds.inspections, insp._id as mongoose.Types.ObjectId);
        }

        // Certificate if PASS
        if (isPass) {
          const certId = await generateCertificateNumber();
          const publicVerId = `PUB-${uuidv4().substring(0, 8).toUpperCase()}`;

          const payloadToSeal = {
            certificateId: certId,
            instrumentId: inst.instrumentId,
            inspectionId: inspId,
            issuedAt: new Date().toISOString()
          };
          const seal = createIntegritySeal(payloadToSeal);

          const existingCert = await Certificate.findOne({ verificationRequest: ver._id });
          if (!existingCert) {
            const certDoc = await Certificate.create({
              certificateNumber: certId,
              publicVerificationId: publicVerId,
              instrument: inst._id,
              owner: inst.owner,
              verificationRequest: ver._id,
              inspection: insp._id,
              instrumentSnapshot: {
                instrumentId: inst.instrumentId,
                type: inst.type,
                category: inst.category,
                manufacturer: inst.manufacturer,
                model: inst.model,
                maskedSerialNumber: inst.serialNumber ? `SN-***${inst.serialNumber.slice(-4)}` : 'SN-****',
                capacity: inst.capacity
              },
              verificationSnapshot: {
                requestId: ver.requestId,
                verificationType: ver.verificationType
              },
              inspectionSnapshot: {
                inspectionId: insp.inspectionId,
                inspectorResult: insp.inspectorResult,
                calculatedAssessment: insp.calculatedAssessment,
                referenceReading: insp.referenceReading,
                actualReading: insp.actualReading,
                deviation: insp.deviation,
                deviationPercentage: insp.deviationPercentage
              },
              verificationDate: insp.inspectionDate,
              issuedAt: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
              validFrom: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
              expiresAt: new Date(Date.now() + 340 * 24 * 60 * 60 * 1000),
              status: 'VALID',
              policySnapshot: {
                policyId: 'POL-DEMO-01',
                name: 'Standard Certificate Policy',
                validityPeriodMonths: 12,
                version: 1
              },
              integrityMetadata: {
                payloadHash: seal.payloadHash,
                hmacSeal: seal.hmacSeal,
                algorithm: seal.algorithm,
                label: seal.label
              },
              createdBy: demoInspector._id
            });
            pushUniqueId(batch.createdRecordIds.certificates, certDoc._id as mongoose.Types.ObjectId);
          } else {
            pushUniqueId(batch.createdRecordIds.certificates, existingCert._id as mongoose.Types.ObjectId);
          }
        } else {
          // Failure -> Create Notice for ~50% of fails
          if (random() > 0.5) {
            const existingNotice = await ImprovementNotice.findOne({ inspection: insp._id });
            if (!existingNotice) {
              const noticeId = await generateNoticeId();
              const noticeDoc = await ImprovementNotice.create({
                noticeId,
                inspection: insp._id,
                instrument: inst._id,
                issuedBy: demoInspector._id,
                reason: 'Observed reading outside maximum allowable statutory tolerance.',
                requiredCorrection: 'Recalibrate instrument and re-apply for verification.',
                issueDate: new Date(),
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                status: 'OPEN'
              });
              pushUniqueId(batch.createdRecordIds.improvementNotices, noticeDoc._id as mongoose.Types.ObjectId);
            } else {
              pushUniqueId(batch.createdRecordIds.improvementNotices, existingNotice._id as mongoose.Types.ObjectId);
            }
          }
        }
      }

      batch.recordCounts = {
        users: batch.createdRecordIds.users?.length || 0,
        instruments: batch.createdRecordIds.instruments?.length || 0,
        verificationRequests: batch.createdRecordIds.verificationRequests?.length || 0,
        inspections: batch.createdRecordIds.inspections?.length || 0,
        certificates: batch.createdRecordIds.certificates?.length || 0,
        complaints: batch.createdRecordIds.complaints?.length || 0,
        improvementNotices: batch.createdRecordIds.improvementNotices?.length || 0
      };

      await batch.save();

      // 4. Invoke Real Analytics Engines for generated instruments
      for (let i = 0; i < Math.min(15, createdInstruments.length); i++) {
        const inst = createdInstruments[i];
        try {
          await riskService.assessInstrument(inst.instrumentId, adminUser);
        } catch (e: any) {
          partialErrors.push(`Risk engine error for ${inst.instrumentId}: ${e.message}`);
        }

        try {
          await regionalService.analyzeRegionalCorrelation(inst.instrumentId, 10, adminUser);
        } catch (e: any) {
          partialErrors.push(`Regional engine error for ${inst.instrumentId}: ${e.message}`);
        }

        try {
          await anomalyService.analyzeInstrument(inst.instrumentId, adminUser);
        } catch (e: any) {
          partialErrors.push(`Anomaly engine error for ${inst.instrumentId}: ${e.message}`);
        }
      }

      batch.status = partialErrors.length > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED';
      if (partialErrors.length > 0) {
        batch.errorSummary = partialErrors.slice(0, 5).join('; ');
      }
      await batch.save();

      // Log audit action
      await auditService.logAction({
        actor: { userId: adminUser._id.toString(), role: adminUser.role, email: adminUser.email },
        action: 'GENERATE_DEMO_DATA',
        entityType: 'DemoBatch',
        entityId: batch.batchId,
        metadata: { count: batch.count, status: batch.status, recordCounts: batch.recordCounts }
      });

      return batch;
    } catch (err: any) {
      batch.status = 'FAILED';
      batch.errorSummary = err.message;
      await batch.save();
      throw err;
    }
  }
}

export const demoDataService = new DemoDataService();
