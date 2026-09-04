import mongoose from 'mongoose';
import { Instrument } from '../models/instrument.model';
import { Inspection, IInspection } from '../models/inspection.model';
import { AnomalyAssessment, IAnomalyAssessment } from '../models/anomaly-assessment.model';
import { IUser } from '../models/user.model';
import { aiServiceClient, FeatureRecordPayload } from './ai-client.service';
import { computeStatisticalFallback } from '../utils/statistical-fallback.utils';
import { generateAnomalyAssessmentId } from '../utils/anomaly-assessment-id.utils';
import Decimal from 'decimal.js';

export const DISCLAIMER_TEXT =
  'This assessment is decision support only. It does not constitute a legal determination, ' +
  'confirm fraud or tampering, or confirm a defect. It does not override the statutory ' +
  'PASS/FAIL result issued by the assigned authorized inspector.';

export const MIN_SAMPLES_REQUIRED = 5;

export interface ExtractedInstrumentTelemetry {
  instrumentMongoId: mongoose.Types.ObjectId;
  instrumentId: string;
  features: Record<string, number | null>;
  featureBreakdown: Array<{
    name: string;
    value: number | null;
    available: boolean;
    explanation: string;
  }>;
  dataCoverage: number;
  finalizedInspectionsCount: number;
}

export class AnomalyService {
  /**
   * Extract features from genuine finalized MongoDB inspections for an instrument.
   * Never fabricates complaints, repairs, or unrecorded telemetry.
   */
  async extractInstrumentTelemetry(
    instrumentMongoId: mongoose.Types.ObjectId,
    instrumentId: string
  ): Promise<ExtractedInstrumentTelemetry> {
    const inspections = await Inspection.find({
      instrument: instrumentMongoId,
      status: 'FINALIZED'
    }).sort({ inspectionDate: -1 });

    const count = inspections.length;
    if (count === 0) {
      return {
        instrumentMongoId,
        instrumentId,
        features: {
          deviationToToleranceRatio: null,
          absDeviationPct: null,
          passFailIndicator: null,
          priorFailureRate: null,
          avgDeviation: null,
          inspectionCount: 0
        },
        featureBreakdown: [
          {
            name: 'deviationToToleranceRatio',
            value: null,
            available: false,
            explanation: 'No finalized inspections recorded.'
          },
          {
            name: 'absDeviationPct',
            value: null,
            available: false,
            explanation: 'No finalized inspections recorded.'
          },
          {
            name: 'passFailIndicator',
            value: null,
            available: false,
            explanation: 'No finalized inspections recorded.'
          },
          {
            name: 'priorFailureRate',
            value: null,
            available: false,
            explanation: 'No finalized inspections recorded.'
          },
          {
            name: 'avgDeviation',
            value: null,
            available: false,
            explanation: 'No finalized inspections recorded.'
          },
          {
            name: 'inspectionCount',
            value: 0,
            available: true,
            explanation: 'Zero finalized inspections recorded.'
          },
          {
            name: 'complaints',
            value: null,
            available: false,
            explanation: 'Complaints module not implemented. Factor unavailable.'
          },
          {
            name: 'repairs',
            value: null,
            available: false,
            explanation: 'Repairs module not implemented. Factor unavailable.'
          }
        ],
        dataCoverage: 0.0,
        finalizedInspectionsCount: 0
      };
    }

    const latest = inspections[0];

    // 1. Deviation to Tolerance Ratio (using unrounded precise values from snapshot)
    let devToTolRatio: number | null = null;
    if (latest.toleranceSnapshot && latest.toleranceSnapshot.toleranceValue > 0) {
      let allowed = latest.toleranceSnapshot.toleranceValue;
      if (latest.toleranceSnapshot.toleranceMode === 'PERCENTAGE') {
        allowed = (Math.abs(latest.referenceReading) * allowed) / 100;
      }
      if (allowed > 0) {
        devToTolRatio = Math.abs(latest.deviation) / allowed;
      }
    }

    // 2. Absolute Deviation Percentage
    const absDevPct =
      latest.deviationPercentage !== null && latest.deviationPercentage !== undefined
        ? Math.abs(latest.deviationPercentage)
        : null;

    // 3. Pass/Fail Indicator: 0 = PASS, 1 = FAIL
    const passFailIndicator = latest.inspectorResult === 'FAIL' ? 1.0 : 0.0;

    // 4. Prior Failure Rate (ratio of FAILs in all inspections)
    const failCount = inspections.filter((i) => i.inspectorResult === 'FAIL').length;
    const priorFailureRate = count > 0 ? failCount / count : 0.0;

    // 5. Average Deviation
    const sumDeviation = inspections.reduce((acc, i) => acc.plus(new Decimal(Math.abs(i.deviation))), new Decimal(0));
    const avgDeviation = sumDeviation.dividedBy(count).toNumber();

    const features: Record<string, number | null> = {
      deviationToToleranceRatio: devToTolRatio !== null ? Math.round(devToTolRatio * 10000) / 10000 : null,
      absDeviationPct: absDevPct !== null ? Math.round(absDevPct * 10000) / 10000 : null,
      passFailIndicator,
      priorFailureRate: Math.round(priorFailureRate * 10000) / 10000,
      avgDeviation: Math.round(avgDeviation * 10000) / 10000,
      inspectionCount: count
    };

    const featureBreakdown = [
      {
        name: 'deviationToToleranceRatio',
        value: features.deviationToToleranceRatio,
        available: features.deviationToToleranceRatio !== null,
        explanation: 'Ratio of observed reading deviation to maximum allowable statutory tolerance.'
      },
      {
        name: 'absDeviationPct',
        value: features.absDeviationPct,
        available: features.absDeviationPct !== null,
        explanation: 'Absolute deviation percentage relative to reference reading.'
      },
      {
        name: 'passFailIndicator',
        value: features.passFailIndicator,
        available: true,
        explanation: 'Latest finalized inspection result: 0 for PASS, 1 for FAIL.'
      },
      {
        name: 'priorFailureRate',
        value: features.priorFailureRate,
        available: true,
        explanation: `Historical failure rate across ${count} finalized inspection(s).`
      },
      {
        name: 'avgDeviation',
        value: features.avgDeviation,
        available: true,
        explanation: 'Historical mean absolute deviation across all finalized inspections.'
      },
      {
        name: 'inspectionCount',
        value: count,
        available: true,
        explanation: 'Total number of finalized inspections on record.'
      },
      {
        name: 'complaints',
        value: null,
        available: false,
        explanation: 'Complaints module not implemented. Factor unavailable.'
      },
      {
        name: 'repairs',
        value: null,
        available: false,
        explanation: 'Repairs module not implemented. Factor unavailable.'
      }
    ];

    const availableStandardCount = Object.values(features).filter((v) => v !== null).length;
    const dataCoverage = Math.round((availableStandardCount / 6) * 100) / 100;

    return {
      instrumentMongoId,
      instrumentId,
      features,
      featureBreakdown,
      dataCoverage,
      finalizedInspectionsCount: count
    };
  }

  /**
   * Run anomaly analysis on a single instrument or across the population.
   */
  async analyzeInstrument(
    instrumentIdStr: string,
    caller: IUser
  ): Promise<IAnomalyAssessment> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can trigger anomaly analysis'), { statusCode: 403 });
    }

    const instrument = await Instrument.findOne({ instrumentId: instrumentIdStr.trim().toUpperCase() });
    if (!instrument) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    // 1. Extract telemetry for target instrument
    const targetTelemetry = await this.extractInstrumentTelemetry(
      instrument._id as mongoose.Types.ObjectId,
      instrument.instrumentId
    );

    // If target has zero finalized inspections, return INSUFFICIENT_DATA immediately
    if (targetTelemetry.finalizedInspectionsCount === 0) {
      const assessmentId = await generateAnomalyAssessmentId();
      const assessment = new AnomalyAssessment({
        assessmentId,
        instrument: instrument._id,
        instrumentIdSnapshot: instrument.instrumentId,
        method: 'INSUFFICIENT_DATA',
        status: 'INSUFFICIENT_DATA',
        potentialAnomaly: false,
        anomalyScore: null,
        confidence: null,
        features: targetTelemetry.featureBreakdown,
        dataCoverage: 0.0,
        contributingFactors: [],
        modelMetadata: {
          algorithm: 'None',
          version: 'N/A',
          sampleCount: 0,
          featuresUsed: []
        },
        disclaimer: DISCLAIMER_TEXT,
        assessedBy: caller._id,
        assessedAt: new Date()
      });
      await assessment.save();
      return assessment;
    }

    // 2. Gather peer population telemetry (all instruments with at least 1 finalized inspection)
    // Find all instruments with finalized inspections
    const distinctInstrumentIds = await Inspection.distinct('instrument', { status: 'FINALIZED' });

    const peerTelemetryList: ExtractedInstrumentTelemetry[] = [];
    for (const instId of distinctInstrumentIds) {
      const instDoc = await Instrument.findById(instId);
      if (instDoc) {
        const tel = await this.extractInstrumentTelemetry(instDoc._id as mongoose.Types.ObjectId, instDoc.instrumentId);
        peerTelemetryList.push(tel);
      }
    }

    // Prepare batch payload for AI service
    const records: FeatureRecordPayload[] = peerTelemetryList.map((p) => ({
      recordId: p.instrumentId,
      features: p.features
    }));

    let assessmentDoc: IAnomalyAssessment;

    // Try FastAPI AI Service first
    try {
      const aiResponse = await aiServiceClient.detectAnomaly({
        records,
        targetRecordId: instrument.instrumentId,
        minSamples: MIN_SAMPLES_REQUIRED
      });

      if (aiResponse.status === 'INSUFFICIENT_DATA') {
        // AI service signaled insufficient samples
        // Check if we can run deterministic statistical fallback or return INSUFFICIENT_DATA
        if (records.length < 2) {
          const assessmentId = await generateAnomalyAssessmentId();
          assessmentDoc = new AnomalyAssessment({
            assessmentId,
            instrument: instrument._id,
            instrumentIdSnapshot: instrument.instrumentId,
            method: 'INSUFFICIENT_DATA',
            status: 'INSUFFICIENT_DATA',
            potentialAnomaly: false,
            anomalyScore: null,
            confidence: null,
            features: targetTelemetry.featureBreakdown,
            dataCoverage: targetTelemetry.dataCoverage,
            contributingFactors: [],
            modelMetadata: {
              algorithm: aiResponse.modelMetadata.algorithm,
              version: aiResponse.modelMetadata.version,
              sampleCount: aiResponse.modelMetadata.sampleCount,
              featuresUsed: []
            },
            disclaimer: DISCLAIMER_TEXT,
            assessedBy: caller._id,
            assessedAt: new Date()
          });
        } else {
          // Use statistical fallback
          const fallback = computeStatisticalFallback(
            targetTelemetry.features,
            records.map((r) => r.features)
          );
          const assessmentId = await generateAnomalyAssessmentId();
          assessmentDoc = new AnomalyAssessment({
            assessmentId,
            instrument: instrument._id,
            instrumentIdSnapshot: instrument.instrumentId,
            method: 'DETERMINISTIC_STATISTICAL_FALLBACK',
            status: fallback.potentialAnomaly ? 'POTENTIAL_ANOMALY' : 'NORMAL',
            potentialAnomaly: fallback.potentialAnomaly,
            anomalyScore: fallback.anomalyScore,
            confidence: fallback.confidence,
            features: targetTelemetry.featureBreakdown,
            dataCoverage: targetTelemetry.dataCoverage,
            contributingFactors: fallback.contributingFactors,
            modelMetadata: {
              algorithm: 'DeterministicZScoreStatistical',
              version: 'stat-fallback-1.0',
              sampleCount: records.length,
              featuresUsed: Object.keys(targetTelemetry.features)
            },
            disclaimer: DISCLAIMER_TEXT,
            assessedBy: caller._id,
            assessedAt: new Date()
          });
        }
      } else {
        // AI service succeeded
        const targetResult = aiResponse.results.find((r) => r.recordId === instrument.instrumentId);
        if (!targetResult) {
          throw new Error('Target record not found in AI service response results');
        }

        const assessmentId = await generateAnomalyAssessmentId();
        assessmentDoc = new AnomalyAssessment({
          assessmentId,
          instrument: instrument._id,
          instrumentIdSnapshot: instrument.instrumentId,
          method: 'ISOLATION_FOREST',
          status: targetResult.status,
          potentialAnomaly: targetResult.potentialAnomaly,
          anomalyScore: targetResult.anomalyScore,
          confidence: targetTelemetry.dataCoverage,
          features: targetTelemetry.featureBreakdown,
          dataCoverage: aiResponse.dataCoverage,
          contributingFactors: targetResult.contributingFeatures,
          modelMetadata: {
            algorithm: aiResponse.modelMetadata.algorithm,
            version: aiResponse.modelMetadata.version,
            sampleCount: aiResponse.modelMetadata.sampleCount,
            contamination: aiResponse.modelMetadata.contamination,
            randomState: aiResponse.modelMetadata.randomState,
            featuresUsed: aiResponse.modelMetadata.featuresUsed
          },
          disclaimer: DISCLAIMER_TEXT,
          assessedBy: caller._id,
          assessedAt: new Date()
        });
      }
    } catch (_err: any) {
      // AI Service unavailable or timed out -> Graceful fallback
      if (records.length < 2) {
        const assessmentId = await generateAnomalyAssessmentId();
        assessmentDoc = new AnomalyAssessment({
          assessmentId,
          instrument: instrument._id,
          instrumentIdSnapshot: instrument.instrumentId,
          method: 'INSUFFICIENT_DATA',
          status: 'INSUFFICIENT_DATA',
          potentialAnomaly: false,
          anomalyScore: null,
          confidence: null,
          features: targetTelemetry.featureBreakdown,
          dataCoverage: targetTelemetry.dataCoverage,
          contributingFactors: [],
          modelMetadata: {
            algorithm: 'None',
            version: 'N/A',
            sampleCount: records.length,
            featuresUsed: []
          },
          disclaimer: DISCLAIMER_TEXT,
          assessedBy: caller._id,
          assessedAt: new Date()
        });
      } else {
        const fallback = computeStatisticalFallback(
          targetTelemetry.features,
          records.map((r) => r.features)
        );
        const assessmentId = await generateAnomalyAssessmentId();
        assessmentDoc = new AnomalyAssessment({
          assessmentId,
          instrument: instrument._id,
          instrumentIdSnapshot: instrument.instrumentId,
          method: 'DETERMINISTIC_STATISTICAL_FALLBACK',
          status: fallback.potentialAnomaly ? 'POTENTIAL_ANOMALY' : 'NORMAL',
          potentialAnomaly: fallback.potentialAnomaly,
          anomalyScore: fallback.anomalyScore,
          confidence: fallback.confidence,
          features: targetTelemetry.featureBreakdown,
          dataCoverage: targetTelemetry.dataCoverage,
          contributingFactors: fallback.contributingFactors,
          modelMetadata: {
            algorithm: 'DeterministicZScoreStatistical',
            version: 'stat-fallback-1.0',
            sampleCount: records.length,
            featuresUsed: Object.keys(targetTelemetry.features)
          },
          disclaimer: DISCLAIMER_TEXT,
          assessedBy: caller._id,
          assessedAt: new Date()
        });
      }
    }

    await assessmentDoc.save();
    return assessmentDoc;
  }

  /**
   * Run batch analysis across all instruments with finalized inspections.
   */
  async analyzeBatch(caller: IUser): Promise<{ totalAnalyzed: number; assessments: IAnomalyAssessment[] }> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can trigger batch anomaly analysis'), { statusCode: 403 });
    }

    const distinctInstrumentIds = await Inspection.distinct('instrument', { status: 'FINALIZED' });
    const results: IAnomalyAssessment[] = [];

    for (const instId of distinctInstrumentIds) {
      const inst = await Instrument.findById(instId);
      if (inst) {
        const assessment = await this.analyzeInstrument(inst.instrumentId, caller);
        results.push(assessment);
      }
    }

    return {
      totalAnalyzed: results.length,
      assessments: results
    };
  }

  /**
   * Get latest anomaly assessment for an instrument.
   * Scoped to OWNER if requested by owner.
   */
  async getLatestAssessment(instrumentIdStr: string, caller: IUser): Promise<IAnomalyAssessment> {
    const instrument = await Instrument.findOne({ instrumentId: instrumentIdStr.trim().toUpperCase() });
    if (!instrument) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER') {
      if (instrument.owner.toString() !== (caller._id as any).toString()) {
        throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
      }
    }

    const assessment = await AnomalyAssessment.findOne({ instrument: instrument._id })
      .sort({ assessedAt: -1 })
      .populate('assessedBy', 'name role -_id');

    if (!assessment) {
      throw Object.assign(new Error('No anomaly assessment found for this instrument'), { statusCode: 404 });
    }

    return assessment;
  }

  /**
   * List instruments flagged with potential anomalies.
   * Access: ADMIN and INSPECTOR.
   */
  async getPotentialAnomalies(caller: IUser): Promise<any[]> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can access potential anomalies list'), { statusCode: 403 });
    }

    // Get latest assessment for each instrument where potentialAnomaly === true
    const pipeline = [
      {
        $sort: { instrument: 1 as 1, assessedAt: -1 as -1 }
      },
      {
        $group: {
          _id: '$instrument',
          latest: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latest' }
      },
      {
        $match: { potentialAnomaly: true }
      },
      {
        $sort: { anomalyScore: -1 as -1, assessedAt: -1 as -1 }
      }
    ];

    const results = await AnomalyAssessment.aggregate(pipeline as any);
    return results;
  }
}

export const anomalyService = new AnomalyService();
