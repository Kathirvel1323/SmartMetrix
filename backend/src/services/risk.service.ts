import mongoose from 'mongoose';
import { RiskConfiguration, IRiskConfiguration, IRiskWeights, RISK_WEIGHT_FIELDS } from '../models/risk-config.model';
import { RiskAssessment } from '../models/risk-assessment.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { IUser } from '../models/user.model';
import { generateRiskConfigId } from '../utils/risk-config-id.utils';
import { generateRiskAssessmentId } from '../utils/risk-assessment-id.utils';
import {
  calculateRiskScore,
  calculateTrustScore,
  InspectionStats
} from '../utils/risk-assessment.utils';
import Decimal from 'decimal.js';

export interface CreateRiskConfigDTO {
  name: string;
  weights: IRiskWeights;
  thresholds: {
    LOW: { min: number; max: number };
    MEDIUM: { min: number; max: number };
    HIGH: { min: number; max: number };
    CRITICAL: { min: number; max: number };
  };
  missingDataStrategy?: 'RENORMALIZE' | 'ZERO';
}

export interface ListAssessmentsQuery {
  page?: number;
  limit?: number;
}

export class RiskService {
  // ---------------------------------------------------------------------------
  // Configuration management
  // ---------------------------------------------------------------------------

  /**
   * Validates that the weights object:
   * 1. Contains exactly the 9 required factor keys.
   * 2. All values are numeric and >= 0.
   * 3. Sum exactly equals 100.
   */
  private validateWeights(weights: IRiskWeights): void {
    const requiredKeys = RISK_WEIGHT_FIELDS as readonly string[];
    const providedKeys = Object.keys(weights);

    for (const key of requiredKeys) {
      if (!(key in weights)) {
        throw Object.assign(new Error(`Missing weight for factor '${key}'`), { statusCode: 400 });
      }
    }
    for (const key of providedKeys) {
      if (!requiredKeys.includes(key)) {
        throw Object.assign(new Error(`Unknown weight factor '${key}'`), { statusCode: 400 });
      }
      const val = (weights as any)[key];
      if (typeof val !== 'number' || !isFinite(val) || val < 0) {
        throw Object.assign(
          new Error(`Weight for '${key}' must be a non-negative finite number`),
          { statusCode: 400 }
        );
      }
    }

    // Use decimal-safe summation to avoid floating-point drift
    const total = requiredKeys.reduce(
      (sum, k) => new Decimal(sum).plus((weights as any)[k]).toNumber(),
      0
    );
    // Allow tiny floating-point epsilon (< 1e-9) but fail on anything visible
    if (Math.abs(total - 100) > 1e-6) {
      throw Object.assign(
        new Error(`Weights must sum exactly to 100 (current sum: ${total})`),
        { statusCode: 400 }
      );
    }
  }

  /**
   * Validates that thresholds are ordered and non-overlapping:
   * 0 <= LOW.max < MEDIUM.max < HIGH.max < CRITICAL.max == 100
   */
  private validateThresholds(thresholds: CreateRiskConfigDTO['thresholds']): void {
    const { LOW, MEDIUM, HIGH, CRITICAL } = thresholds;

    if (LOW.min !== 0) {
      throw Object.assign(new Error('LOW threshold min must be 0'), { statusCode: 400 });
    }
    if (CRITICAL.max !== 100) {
      throw Object.assign(new Error('CRITICAL threshold max must be 100'), { statusCode: 400 });
    }
    // Check continuity and order
    if (LOW.max <= LOW.min || MEDIUM.max <= LOW.max || HIGH.max <= MEDIUM.max || CRITICAL.max <= HIGH.max) {
      throw Object.assign(
        new Error('Thresholds must be strictly increasing: LOW.max < MEDIUM.max < HIGH.max < CRITICAL.max (=100)'),
        { statusCode: 400 }
      );
    }
    // Ensure contiguous (adjacent bands meet)
    if (MEDIUM.min !== LOW.max || HIGH.min !== MEDIUM.max || CRITICAL.min !== HIGH.max) {
      throw Object.assign(
        new Error('Thresholds must be contiguous: each band min must equal the previous band max'),
        { statusCode: 400 }
      );
    }
  }

  async createConfiguration(data: CreateRiskConfigDTO, caller: IUser): Promise<IRiskConfiguration> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can create risk configurations'), { statusCode: 403 });
    }

    this.validateWeights(data.weights);
    this.validateThresholds(data.thresholds);

    const configId = await generateRiskConfigId();
    const config = new RiskConfiguration({
      configId,
      name: data.name.trim(),
      weights: data.weights,
      thresholds: data.thresholds,
      missingDataStrategy: data.missingDataStrategy ?? 'RENORMALIZE',
      isActive: false, // newly created configs are inactive; must be activated explicitly
      version: 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await config.save();
    return config;
  }

  /**
   * Activates a configuration. Atomically deactivates all other configs first,
   * then activates the target. The partial-unique index on { isActive: true }
   * provides a secondary DB-level guard.
   */
  async activateConfiguration(configId: string, caller: IUser): Promise<IRiskConfiguration> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can activate risk configurations'), { statusCode: 403 });
    }

    const config = await RiskConfiguration.findOne({ configId: configId.trim().toUpperCase() });
    if (!config) {
      throw Object.assign(new Error('Risk configuration not found'), { statusCode: 404 });
    }
    if (config.isActive) {
      throw Object.assign(new Error('Configuration is already active'), { statusCode: 409 });
    }

    // Deactivate all currently active configs (should be at most one)
    await RiskConfiguration.updateMany(
      { isActive: true },
      { $set: { isActive: false, updatedBy: caller._id } }
    );

    config.isActive = true;
    (config as any).updatedBy = caller._id;
    try {
      await config.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw Object.assign(new Error('Another configuration is already active'), { statusCode: 409 });
      }
      throw err;
    }
    return config;
  }

  async listConfigurations(caller: IUser): Promise<IRiskConfiguration[]> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can list all risk configurations'), { statusCode: 403 });
    }
    return RiskConfiguration.find({}).sort({ createdAt: -1 });
  }

  async getActiveConfiguration(caller: IUser): Promise<IRiskConfiguration> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Access forbidden'), { statusCode: 403 });
    }
    const config = await RiskConfiguration.findOne({ isActive: true });
    if (!config) {
      throw Object.assign(
        new Error('No active risk configuration found. An ADMIN must create and activate one before assessments can be performed.'),
        { statusCode: 404 }
      );
    }
    return config;
  }

  // ---------------------------------------------------------------------------
  // Assessment
  // ---------------------------------------------------------------------------

  /**
   * Aggregate real inspection statistics for an instrument from finalized inspections.
   * Only uses genuine DB records — never fabricates data.
   */
  private async aggregateInspectionStats(instrumentId: mongoose.Types.ObjectId): Promise<InspectionStats> {
    const inspections = await Inspection.find({
      instrument: instrumentId,
      status: 'FINALIZED'
    }).select('inspectorResult calculatedAssessment deviationPercentage deviation referenceReading');

    const total = inspections.length;
    if (total === 0) {
      return { total: 0, passed: 0, failed: 0, outsideTolerance: 0, meanAbsDeviationPct: null, hasData: false };
    }

    let passed = 0;
    let failed = 0;
    let outsideTolerance = 0;
    let deviationPctSum = new Decimal(0);
    let deviationPctCount = 0;

    for (const insp of inspections) {
      if (insp.inspectorResult === 'PASS') passed++;
      else failed++;

      if (insp.calculatedAssessment === 'OUTSIDE_TOLERANCE') outsideTolerance++;

      // Use deviationPercentage if reference was non-zero, else fall back to none
      if (insp.deviationPercentage !== null && insp.deviationPercentage !== undefined) {
        deviationPctSum = deviationPctSum.plus(new Decimal(Math.abs(insp.deviationPercentage)));
        deviationPctCount++;
      }
    }

    const meanAbsDeviationPct =
      deviationPctCount > 0
        ? deviationPctSum.dividedBy(deviationPctCount).toDecimalPlaces(6).toNumber()
        : null;

    return { total, passed, failed, outsideTolerance, meanAbsDeviationPct, hasData: true };
  }

  async assessInstrument(instrumentId: string, caller: IUser) {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can perform risk assessments'), { statusCode: 403 });
    }

    // Resolve instrument
    const instrument = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!instrument) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    // Get active config
    const config = await RiskConfiguration.findOne({ isActive: true });
    if (!config) {
      throw Object.assign(
        new Error('No active risk configuration. An ADMIN must activate a configuration before assessments can be performed.'),
        { statusCode: 422 }
      );
    }

    // Aggregate real inspection data
    const stats = await this.aggregateInspectionStats(instrument._id as mongoose.Types.ObjectId);

    // Calculate scores
    const riskResult = calculateRiskScore(instrument as any, stats, config);
    const trustResult = calculateTrustScore(instrument as any, stats);

    // Generate assessment ID
    const assessmentId = await generateRiskAssessmentId();

    // Build immutable config snapshot
    const configSnapshot = {
      configId: config.configId,
      name: config.name,
      weights: { ...config.weights },
      thresholds: { ...config.thresholds },
      missingDataStrategy: config.missingDataStrategy,
      version: config.version
    };

    const assessment = new RiskAssessment({
      assessmentId,
      instrument: instrument._id,
      instrumentIdSnapshot: instrument.instrumentId,
      configSnapshot,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
      riskFactors: riskResult.riskFactors,
      missingFactors: riskResult.missingFactors,
      dataCoverage: riskResult.dataCoverage,
      recommendedAction: riskResult.recommendedAction,
      disclaimer: riskResult.disclaimer,
      trustScore: trustResult.trustScore,
      trustLevel: trustResult.trustLevel,
      trustFactors: trustResult.trustFactors,
      trustDataCoverage: trustResult.trustDataCoverage,
      trustExplanation: trustResult.trustExplanation,
      assessedBy: caller._id,
      assessedAt: new Date()
    });

    await assessment.save();
    return assessment;
  }

  async getLatestAssessment(instrumentId: string, caller: IUser) {
    const instrument = await this.resolveInstrumentWithOwnerCheck(instrumentId, caller);

    const assessment = await RiskAssessment.findOne({ instrument: instrument._id })
      .sort({ assessedAt: -1 })
      .populate('assessedBy', 'name role -_id');

    if (!assessment) {
      throw Object.assign(new Error('No risk assessment found for this instrument'), { statusCode: 404 });
    }
    return assessment;
  }

  async getAssessmentHistory(instrumentId: string, query: ListAssessmentsQuery, caller: IUser) {
    const instrument = await this.resolveInstrumentWithOwnerCheck(instrumentId, caller);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      RiskAssessment.find({ instrument: instrument._id })
        .sort({ assessedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assessedBy', 'name role -_id'),
      RiskAssessment.countDocuments({ instrument: instrument._id })
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  /**
   * Priority list: instruments ranked by latest risk score (highest first).
   * Only instruments with at least one assessment are included.
   */
  async getPriorityList(caller: IUser) {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can view the priority list'), { statusCode: 403 });
    }

    // For each instrument, get its most recent assessment
    const latest = await RiskAssessment.aggregate([
      {
        $sort: { instrument: 1, assessedAt: -1 }
      },
      {
        $group: {
          _id: '$instrument',
          latestAssessment: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestAssessment' }
      },
      {
        $sort: { riskScore: -1, assessedAt: -1 }
      },
      { $limit: 100 }
    ]);

    return latest;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve instrument by public instrumentId string and enforce owner scoping.
   * OWNERs may only view assessments for instruments they own.
   */
  private async resolveInstrumentWithOwnerCheck(instrumentId: string, caller: IUser) {
    const instrument = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!instrument) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER') {
      if (instrument.owner.toString() !== (caller._id as any).toString()) {
        throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
      }
    }

    return instrument;
  }
}

export const riskService = new RiskService();
