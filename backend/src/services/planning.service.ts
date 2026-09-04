import mongoose from 'mongoose';
import { VerificationMethodRule, IVerificationMethodRule, IFacilityProfile } from '../models/verification-rule.model';
import { IPlanningTwinRepresentation, IVerificationBurdenPlan } from '../models/planning-twin.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { IUser } from '../models/user.model';
import { generateVerificationRuleId } from '../utils/phase7-id.utils';
import { calculateHaversineDistance, LocationCoords } from '../utils/regional-calculator.utils';
import Decimal from 'decimal.js';

export interface CreateVerificationRuleDTO {
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  verificationMethod: string;
  requiredEquipment: string[];
  estimatedEffortHours?: number;
  authorizedFacilityProfiles?: IFacilityProfile[];
}

export interface GeoScheduleRequestDTO {
  instrumentId: string;
  inspectorLocations?: Array<{
    inspectorId: string;
    name: string;
    coordinates: [number, number]; // [lon, lat]
    activeSchedulesCount?: number;
  }>;
}

export class PlanningService {
  async createVerificationRule(data: CreateVerificationRuleDTO, caller: IUser): Promise<IVerificationMethodRule> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can create verification method rules'), { statusCode: 403 });
    }

    const ruleId = await generateVerificationRuleId();
    const rule = new VerificationMethodRule({
      ruleId,
      name: data.name.trim(),
      instrumentType: data.instrumentType.trim(),
      instrumentCategory: data.instrumentCategory.trim(),
      verificationMethod: data.verificationMethod.trim(),
      requiredEquipment: data.requiredEquipment,
      estimatedEffortHours: data.estimatedEffortHours ?? 2,
      authorizedFacilityProfiles: data.authorizedFacilityProfiles ?? [],
      isActive: true,
      version: 1,
      createdBy: caller._id,
      updatedBy: caller._id
    });

    await rule.save();
    return rule;
  }

  async listVerificationRules(caller: IUser): Promise<IVerificationMethodRule[]> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Access forbidden'), { statusCode: 403 });
    }
    return VerificationMethodRule.find({ isActive: true }).sort({ createdAt: -1 });
  }

  async softDeactivateRule(ruleId: string, caller: IUser): Promise<IVerificationMethodRule> {
    if (caller.role !== 'ADMIN') {
      throw Object.assign(new Error('Only ADMIN can deactivate verification rules'), { statusCode: 403 });
    }

    const rule = await VerificationMethodRule.findOne({ ruleId: ruleId.trim().toUpperCase() });
    if (!rule) {
      throw Object.assign(new Error('Verification rule not found'), { statusCode: 404 });
    }

    rule.isActive = false;
    rule.updatedBy = caller._id as any;
    await rule.save();
    return rule;
  }

  async getPlanningTwin(instrumentId: string, caller: IUser): Promise<IPlanningTwinRepresentation> {
    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER' && inst.owner.toString() !== (caller._id as any).toString()) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const inspections = await Inspection.find({
      instrument: inst._id,
      status: 'FINALIZED'
    }).select('inspectorResult deviationPercentage');

    let passCount = 0;
    let failCount = 0;
    let devSum = new Decimal(0);
    let devCount = 0;

    for (const insp of inspections) {
      if (insp.inspectorResult === 'PASS') passCount++;
      else failCount++;
      if (insp.deviationPercentage !== null && insp.deviationPercentage !== undefined) {
        devSum = devSum.plus(new Decimal(Math.abs(insp.deviationPercentage)));
        devCount++;
      }
    }

    const meanAbsDev = devCount > 0 ? devSum.dividedBy(devCount).toDecimalPlaces(4).toNumber() : null;

    // Matching verification rule
    const rule = await VerificationMethodRule.findOne({
      instrumentType: inst.type,
      instrumentCategory: inst.category,
      isActive: true
    });

    const missingData = [];
    if (inspections.length === 0) missingData.push('NO_FINALIZED_INSPECTION_HISTORY');
    if (!rule) missingData.push('NO_CONFIGURED_VERIFICATION_RULE');

    return {
      instrumentId: inst.instrumentId,
      type: inst.type,
      category: inst.category,
      capacity: inst.capacity,
      coordinates: inst.location.coordinates.coordinates as [number, number],
      inspectionHistorySummary: {
        totalFinalized: inspections.length,
        passCount,
        failCount,
        meanAbsDeviationPct: meanAbsDev
      },
      configuredMethod: rule ? rule.verificationMethod : undefined,
      requiredEquipment: rule ? rule.requiredEquipment : undefined,
      estimatedEffortHours: rule ? rule.estimatedEffortHours : undefined,
      missingDataIndicators: missingData,
      disclaimer: 'Planning Twin representation for decision support only. Not a physics simulator or official verification certificate.'
    };
  }

  async optimizeBurden(instrumentId: string, caller: IUser) {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can perform burden optimization'), { statusCode: 403 });
    }

    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const rule = await VerificationMethodRule.findOne({
      instrumentType: inst.type,
      instrumentCategory: inst.category,
      isActive: true
    });

    if (!rule || !rule.authorizedFacilityProfiles || rule.authorizedFacilityProfiles.length === 0) {
      return {
        status: 'INSUFFICIENT_CONFIGURATION',
        message: 'No active verification method rule or authorized facility profile configured for this instrument type/category.',
        reasons: ['Missing VerificationMethodRule in database for this instrument type/category.'],
        missingData: ['VERIFICATION_RULE_MISSING'],
        recommendedPlans: [],
        disclaimer: 'Decision support output only. Information incomplete.'
      };
    }

    const instLoc: LocationCoords = {
      longitude: inst.location.coordinates.coordinates[0],
      latitude: inst.location.coordinates.coordinates[1]
    };

    const plans: IVerificationBurdenPlan[] = [];

    rule.authorizedFacilityProfiles.forEach((fac, idx) => {
      const facLoc: LocationCoords = {
        longitude: fac.location.coordinates.coordinates[0],
        latitude: fac.location.coordinates.coordinates[1]
      };
      const distanceKm = calculateHaversineDistance(instLoc, facLoc);

      // Check required equipment against available equipment
      const missingEquipment = rule.requiredEquipment.filter(
        (eq) => !fac.availableEquipment.map((e) => e.toLowerCase()).includes(eq.toLowerCase())
      );
      const equipmentAvailable = missingEquipment.length === 0;

      // Burden score formula: distance (km) + (effort * 5) + (penalty for missing equipment)
      const burdenScore = Math.round(distanceKm + rule.estimatedEffortHours * 5 + (equipmentAvailable ? 0 : 50));

      const reasons = [
        `Distance from facility: ${distanceKm} km.`,
        `Estimated effort: ${rule.estimatedEffortHours} hours.`
      ];
      if (!equipmentAvailable) {
        reasons.push(`Missing required equipment: ${missingEquipment.join(', ')}.`);
      } else {
        reasons.push('All required equipment is available at facility.');
      }

      plans.push({
        planId: `PLAN-${idx + 1}`,
        rank: 0, // set after sorting
        verificationMethod: rule.verificationMethod,
        facilityId: fac.facilityId,
        facilityName: fac.name,
        facilityLocation: {
          city: fac.location.city,
          state: fac.location.state,
          distanceKm
        },
        requiredEquipment: rule.requiredEquipment,
        equipmentAvailable,
        missingEquipment,
        estimatedEffortHours: rule.estimatedEffortHours,
        burdenScore,
        reasons,
        disclaimer: 'Decision support optimization only. Non-binding plan recommendation.'
      });
    });

    // Rank plans by lowest burden score first
    plans.sort((a, b) => a.burdenScore - b.burdenScore);
    plans.forEach((p, i) => { p.rank = i + 1; });

    return {
      status: 'SUCCESS',
      instrumentId: inst.instrumentId,
      recommendedPlans: plans,
      disclaimer: 'Decision support optimization only. Does not alter legal inspection duties.'
    };
  }

  async recommendGeoSchedule(dto: GeoScheduleRequestDTO, caller: IUser) {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can generate geo-scheduling recommendations'), { statusCode: 403 });
    }

    const inst = await Instrument.findOne({ instrumentId: dto.instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const instLoc: LocationCoords = {
      longitude: inst.location.coordinates.coordinates[0],
      latitude: inst.location.coordinates.coordinates[1]
    };

    const inspectors = dto.inspectorLocations || [
      { inspectorId: 'INSP-DEF-1', name: 'Default Zone Inspector 1', coordinates: [instLoc.longitude + 0.02, instLoc.latitude + 0.02], activeSchedulesCount: 2 },
      { inspectorId: 'INSP-DEF-2', name: 'Default Zone Inspector 2', coordinates: [instLoc.longitude + 0.1, instLoc.latitude + 0.1], activeSchedulesCount: 5 }
    ];

    const recommendations = inspectors.map((insp) => {
      const inspLoc: LocationCoords = { longitude: insp.coordinates[0], latitude: insp.coordinates[1] };
      const distanceKm = calculateHaversineDistance(instLoc, inspLoc);
      const activeSchedules = insp.activeSchedulesCount ?? 0;
      // Score: distance (km) + activeSchedules * 2
      const score = Math.round(distanceKm + activeSchedules * 2);

      return {
        inspectorId: insp.inspectorId,
        name: insp.name,
        distanceKm,
        activeSchedulesCount: activeSchedules,
        score,
        reason: `Distance: ${distanceKm} km. Active schedules: ${activeSchedules}.`
      };
    });

    recommendations.sort((a, b) => a.score - b.score);

    return {
      status: 'SUCCESS',
      instrumentId: inst.instrumentId,
      recommendations: recommendations.map((r, i) => ({ rank: i + 1, ...r })),
      disclaimer: 'Purely decision support recommendation. Does NOT automatically assign inspectors or mutate existing schedules.'
    };
  }
}

export const planningService = new PlanningService();
