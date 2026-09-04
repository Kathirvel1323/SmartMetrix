import mongoose from 'mongoose';
import { RegionalConfig, IRegionalConfig, IRegionalWeights, REGIONAL_WEIGHT_FIELDS } from '../models/regional-config.model';
import { RegionalCorrelationAssessment, IRegionalCorrelationAssessment } from '../models/regional-correlation.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { RiskAssessment } from '../models/risk-assessment.model';
import { AnomalyAssessment } from '../models/anomaly-assessment.model';
import { IUser } from '../models/user.model';
import { generateRegionalConfigId, generateRegionalAssessmentId } from '../utils/regional-id.utils';
import { calculateInstrumentSimilarity, InstrumentMatchInput } from '../utils/regional-calculator.utils';
import Decimal from 'decimal.js';

export interface CreateRegionalConfigDTO {
  name: string;
  weights: IRegionalWeights;
  similarityThresholds: {
    clusterThreshold: number;
    correlationThreshold: number;
    riskPatternThreshold: number;
  };
  allowedRadiiKm?: number[];
  defaultRadiusKm?: number;
}

export class RegionalService {
  /**
   * Ensures an active RegionalConfig exists. Creates default if none found.
   */
  async ensureDefaultConfig(createdByUserId: mongoose.Types.ObjectId): Promise<IRegionalConfig> {
    const existing = await RegionalConfig.findOne({ isActive: true });
    if (existing) return existing;

    const configId = await generateRegionalConfigId();
    const defaultConfig = new RegionalConfig({
      configId,
      name: 'Standard Regional Intelligence Config v1',
      weights: {
        haversineDistance: 30,
        typeCategory: 20,
        manufacturerModel: 15,
        ageCapacity: 10,
        deviation: 10,
        complaints: 5,
        repairs: 5,
        inspectionHistory: 5
      },
      similarityThresholds: {
        clusterThreshold: 75,
        correlationThreshold: 60,
        riskPatternThreshold: 45
      },
      allowedRadiiKm: [5, 10, 25],
      defaultRadiusKm: 10,
      isActive: true,
      version: 1,
      createdBy: createdByUserId,
      updatedBy: createdByUserId
    });

    await defaultConfig.save();
    return defaultConfig;
  }

  async createConfiguration(data: CreateRegionalConfigDTO, caller: IUser): Promise<IRegionalConfig> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can create regional configurations'), { statusCode: 403 });
    }

    const configId = await generateRegionalConfigId();
    const config = new RegionalConfig({
      configId,
      name: data.name.trim(),
      weights: data.weights,
      similarityThresholds: data.similarityThresholds,
      allowedRadiiKm: data.allowedRadiiKm ?? [5, 10, 25],
      defaultRadiusKm: data.defaultRadiusKm ?? 10,
      isActive: false,
      version: 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await config.save();
    return config;
  }

  async activateConfiguration(configId: string, caller: IUser): Promise<IRegionalConfig> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can activate regional configurations'), { statusCode: 403 });
    }

    const config = await RegionalConfig.findOne({ configId: configId.trim().toUpperCase() });
    if (!config) {
      throw Object.assign(new Error('Regional configuration not found'), { statusCode: 404 });
    }

    await RegionalConfig.updateMany({ isActive: true }, { $set: { isActive: false, updatedBy: caller._id } });
    config.isActive = true;
    (config as any).updatedBy = caller._id;
    await config.save();
    return config;
  }

  async getActiveConfiguration(caller: IUser): Promise<IRegionalConfig> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Access forbidden'), { statusCode: 403 });
    }
    return this.ensureDefaultConfig(caller._id as mongoose.Types.ObjectId);
  }

  private async fetchInstrumentMatchInput(inst: any): Promise<InstrumentMatchInput> {
    const inspections = await Inspection.find({
      instrument: inst._id,
      status: 'FINALIZED'
    }).select('inspectorResult deviationPercentage');

    let meanDevPct: number | null = null;
    let passRate: number | null = null;

    if (inspections.length > 0) {
      let passCount = 0;
      let devSum = new Decimal(0);
      let devCount = 0;

      for (const insp of inspections) {
        if (insp.inspectorResult === 'PASS') passCount++;
        if (insp.deviationPercentage !== null && insp.deviationPercentage !== undefined) {
          devSum = devSum.plus(new Decimal(Math.abs(insp.deviationPercentage)));
          devCount++;
        }
      }

      passRate = new Decimal(passCount).dividedBy(inspections.length).toDecimalPlaces(4).toNumber();
      if (devCount > 0) {
        meanDevPct = devSum.dividedBy(devCount).toDecimalPlaces(4).toNumber();
      }
    }

    return {
      instrumentId: inst.instrumentId,
      type: inst.type,
      category: inst.category,
      manufacturer: inst.manufacturer,
      model: inst.model,
      capacityValue: inst.capacity.value,
      capacityUnit: inst.capacity.unit,
      coordinates: inst.location.coordinates.coordinates as [number, number],
      meanDeviationPct: meanDevPct,
      passRate
    };
  }

  async analyzeRegionalCorrelation(instrumentId: string, requestedRadiusKm?: number, caller?: IUser) {
    if (caller && !['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can perform regional correlation analysis'), { statusCode: 403 });
    }

    const targetInst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!targetInst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const userId = caller ? (caller._id as mongoose.Types.ObjectId) : targetInst.createdBy;
    const config = await this.ensureDefaultConfig(userId);

    const radiusKm = requestedRadiusKm && config.allowedRadiiKm.includes(requestedRadiusKm)
      ? requestedRadiusKm
      : config.defaultRadiusKm;

    const targetInput = await this.fetchInstrumentMatchInput(targetInst);

    // Find nearby candidate instruments in MongoDB using $near or $geoWithin
    const [targetLon, targetLat] = targetInst.location.coordinates.coordinates;
    const radiusMeters = radiusKm * 1000;

    const nearbyInstruments = await Instrument.find({
      _id: { $ne: targetInst._id },
      isArchived: false,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [targetLon, targetLat]
          },
          $maxDistance: radiusMeters
        }
      }
    });

    const matches = [];
    let sumScore = new Decimal(0);
    let highestScore = 0;

    for (const cand of nearbyInstruments) {
      const candInput = await this.fetchInstrumentMatchInput(cand);
      const simResult = calculateInstrumentSimilarity(targetInput, candInput, radiusKm, config.weights);

      if (simResult.distanceKm <= radiusKm) {
        if (simResult.similarityScore > highestScore) {
          highestScore = simResult.similarityScore;
        }
        sumScore = sumScore.plus(simResult.similarityScore);

        matches.push({
          instrumentId: cand.instrumentId,
          distanceKm: simResult.distanceKm,
          similarityScore: simResult.similarityScore,
          commonFactors: simResult.commonFactors,
          type: cand.type,
          category: cand.category,
          manufacturer: cand.manufacturer,
          model: cand.model
        });
      }
    }

    // Sort matches by highest similarity score first
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    const avgScore = matches.length > 0
      ? sumScore.dividedBy(matches.length).toDecimalPlaces(2).toNumber()
      : 0;

    // Pattern type determination from similarity thresholds
    let patternType: 'Potential Cluster' | 'Correlation' | 'Risk Pattern' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
    if (highestScore >= config.similarityThresholds.clusterThreshold) {
      patternType = 'Potential Cluster';
    } else if (highestScore >= config.similarityThresholds.correlationThreshold) {
      patternType = 'Correlation';
    } else if (highestScore >= config.similarityThresholds.riskPatternThreshold) {
      patternType = 'Risk Pattern';
    }

    let recommendedAction = 'Continue routine regional verification monitoring.';
    if (patternType === 'Potential Cluster') {
      recommendedAction = 'Recommend joint regional inspection sweep due to high spatial-technical correlation.';
    } else if (patternType === 'Correlation') {
      recommendedAction = 'Recommend targeted regional sample verification for similar equipment profiles.';
    } else if (patternType === 'Risk Pattern') {
      recommendedAction = 'Monitor regional performance trends during next scheduled verification cycle.';
    }

    const assessmentId = await generateRegionalAssessmentId();
    const assessment = new RegionalCorrelationAssessment({
      assessmentId,
      instrument: targetInst._id,
      instrumentIdSnapshot: targetInst.instrumentId,
      radiusKm,
      configSnapshot: {
        configId: config.configId,
        weights: config.weights as any,
        version: config.version
      },
      similarInstruments: matches,
      averageSimilarityScore: avgScore,
      highestSimilarityScore: highestScore,
      patternType,
      missingFactors: ['age', 'complaints', 'repairs'],
      dataCoverage: 62.5, // 5 of 8 factors available
      recommendedAction,
      disclaimer: 'Decision support output only. Does not constitute legal proof or confirmation of fraud, defect, or tampering.',
      assessedBy: userId,
      assessedAt: new Date()
    });

    await assessment.save();
    return assessment;
  }

  async getLatestCorrelation(instrumentId: string, caller: IUser) {
    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER' && inst.owner.toString() !== (caller._id as any).toString()) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const latest = await RegionalCorrelationAssessment.findOne({ instrument: inst._id })
      .sort({ assessedAt: -1 })
      .populate('assessedBy', 'name role -_id');

    if (!latest) {
      throw Object.assign(new Error('No regional correlation assessment found for this instrument'), { statusCode: 404 });
    }
    return latest;
  }

  async getRegionalClusters(caller: IUser) {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can list regional clusters'), { statusCode: 403 });
    }

    const clusters = await RegionalCorrelationAssessment.aggregate([
      { $sort: { instrument: 1, assessedAt: -1 } },
      {
        $group: {
          _id: '$instrument',
          latest: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$latest' } },
      { $match: { patternType: { $in: ['Potential Cluster', 'Correlation', 'Risk Pattern'] } } },
      { $sort: { highestSimilarityScore: -1, assessedAt: -1 } }
    ]);

    return clusters;
  }

  async getRegionalMapData(caller: IUser) {
    // Both ADMIN, INSPECTOR, and OWNER (with privacy filter for OWNER) can access map
    const instruments = caller.role === 'OWNER'
      ? await Instrument.find({ owner: caller._id, isArchived: false })
      : await Instrument.find({ isArchived: false });

    const features = [];

    for (const inst of instruments) {
      const [latestRisk, latestAnomaly, latestCorr] = await Promise.all([
        RiskAssessment.findOne({ instrument: inst._id }).sort({ assessedAt: -1 }),
        AnomalyAssessment.findOne({ instrument: inst._id }).sort({ assessedAt: -1 }),
        RegionalCorrelationAssessment.findOne({ instrument: inst._id }).sort({ assessedAt: -1 })
      ]);

      features.push({
        type: 'Feature',
        geometry: inst.location.coordinates,
        properties: {
          instrumentId: inst.instrumentId,
          type: inst.type,
          category: inst.category,
          city: inst.location.city,
          district: inst.location.district,
          state: inst.location.state,
          status: inst.status,
          riskLevel: latestRisk ? latestRisk.riskLevel : 'NOT_ASSESSED',
          riskScore: latestRisk ? latestRisk.riskScore : null,
          trustLevel: latestRisk ? latestRisk.trustLevel : 'NOT_ASSESSED',
          trustScore: latestRisk ? latestRisk.trustScore : null,
          potentialAnomaly: latestAnomaly ? latestAnomaly.potentialAnomaly : false,
          anomalyScore: latestAnomaly ? latestAnomaly.anomalyScore : null,
          patternType: latestCorr ? latestCorr.patternType : 'NOT_ASSESSED',
          recommendedAction: latestCorr ? latestCorr.recommendedAction : 'No regional action required'
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }
}

export const regionalService = new RegionalService();
