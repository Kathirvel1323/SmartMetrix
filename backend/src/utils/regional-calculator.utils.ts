import Decimal from 'decimal.js';
import { IRegionalWeights } from '../models/regional-config.model';

export interface LocationCoords {
  longitude: number;
  latitude: number;
}

/**
 * Calculates Haversine distance in kilometers between two geographic points.
 */
export function calculateHaversineDistance(loc1: LocationCoords, loc2: LocationCoords): number {
  const EARTH_RADIUS_KM = 6371;
  const dLat = (loc2.latitude - loc1.latitude) * (Math.PI / 180);
  const dLon = (loc2.longitude - loc1.longitude) * (Math.PI / 180);

  const lat1Rad = loc1.latitude * (Math.PI / 180);
  const lat2Rad = loc2.latitude * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return new Decimal(distance).toDecimalPlaces(3).toNumber();
}

export interface InstrumentMatchInput {
  instrumentId: string;
  type: string;
  category: string;
  manufacturer: string;
  model: string;
  capacityValue: number;
  capacityUnit: string;
  coordinates: [number, number]; // [lon, lat]
  meanDeviationPct: number | null;
  passRate: number | null;
}

export interface SimilarityResult {
  similarityScore: number;
  distanceKm: number;
  commonFactors: string[];
  missingFactors: string[];
  dataCoverage: number;
}

/**
 * Calculates multi-factor similarity between target instrument and reference instrument
 * using configured weights and radius. Transparently renormalizes missing factors.
 */
export function calculateInstrumentSimilarity(
  target: InstrumentMatchInput,
  ref: InstrumentMatchInput,
  radiusKm: number,
  configWeights: IRegionalWeights
): SimilarityResult {
  const targetLoc: LocationCoords = { longitude: target.coordinates[0], latitude: target.coordinates[1] };
  const refLoc: LocationCoords = { longitude: ref.coordinates[0], latitude: ref.coordinates[1] };

  const distanceKm = calculateHaversineDistance(targetLoc, refLoc);

  const commonFactors: string[] = [];
  const missingFactors: string[] = ['age', 'complaints', 'repairs']; // Transparently marked as missing per specification

  let weightedSum = new Decimal(0);
  let availableWeightTotal = new Decimal(0);

  // 1. Haversine distance score (30%)
  if (distanceKm <= radiusKm) {
    const geoScore = new Decimal(1).minus(new Decimal(distanceKm).dividedBy(radiusKm)).times(100).toNumber();
    weightedSum = weightedSum.plus(new Decimal(geoScore).times(configWeights.haversineDistance));
    availableWeightTotal = availableWeightTotal.plus(configWeights.haversineDistance);
    commonFactors.push('geographic_proximity');
  } else {
    // Exceeds radius, geo score 0
    weightedSum = weightedSum.plus(0);
    availableWeightTotal = availableWeightTotal.plus(configWeights.haversineDistance);
  }

  // 2. Type & Category (20%)
  let typeCatScore = 0;
  if (target.type.toLowerCase() === ref.type.toLowerCase() && target.category.toLowerCase() === ref.category.toLowerCase()) {
    typeCatScore = 100;
    commonFactors.push('type_and_category');
  } else if (target.category.toLowerCase() === ref.category.toLowerCase()) {
    typeCatScore = 50;
    commonFactors.push('category');
  }
  weightedSum = weightedSum.plus(new Decimal(typeCatScore).times(configWeights.typeCategory));
  availableWeightTotal = availableWeightTotal.plus(configWeights.typeCategory);

  // 3. Manufacturer & Model (15%)
  let mfgModelScore = 0;
  if (target.manufacturer.toLowerCase() === ref.manufacturer.toLowerCase() && target.model.toLowerCase() === ref.model.toLowerCase()) {
    mfgModelScore = 100;
    commonFactors.push('manufacturer_and_model');
  } else if (target.manufacturer.toLowerCase() === ref.manufacturer.toLowerCase()) {
    mfgModelScore = 50;
    commonFactors.push('manufacturer');
  }
  weightedSum = weightedSum.plus(new Decimal(mfgModelScore).times(configWeights.manufacturerModel));
  availableWeightTotal = availableWeightTotal.plus(configWeights.manufacturerModel);

  // 4. Age & Capacity (10%) — capacity comparison (age missing)
  let capScore = 0;
  if (target.capacityUnit.toLowerCase() === ref.capacityUnit.toLowerCase()) {
    const ratio = Math.min(target.capacityValue, ref.capacityValue) / Math.max(target.capacityValue, ref.capacityValue);
    capScore = Math.round(ratio * 100);
    if (capScore >= 80) commonFactors.push('similar_capacity');
  }
  weightedSum = weightedSum.plus(new Decimal(capScore).times(configWeights.ageCapacity));
  availableWeightTotal = availableWeightTotal.plus(configWeights.ageCapacity);

  // 5. Deviation (10%)
  if (target.meanDeviationPct !== null && ref.meanDeviationPct !== null) {
    const diff = Math.abs(target.meanDeviationPct - ref.meanDeviationPct);
    const devScore = Math.max(0, Math.round(100 - diff * 10));
    weightedSum = weightedSum.plus(new Decimal(devScore).times(configWeights.deviation));
    availableWeightTotal = availableWeightTotal.plus(configWeights.deviation);
    if (devScore >= 70) commonFactors.push('similar_deviation');
  } else {
    missingFactors.push('deviation_history');
  }

  // 6. Inspection History (5%)
  if (target.passRate !== null && ref.passRate !== null) {
    const passDiff = Math.abs(target.passRate - ref.passRate);
    const histScore = Math.max(0, Math.round(100 - passDiff * 100));
    weightedSum = weightedSum.plus(new Decimal(histScore).times(configWeights.inspectionHistory));
    availableWeightTotal = availableWeightTotal.plus(configWeights.inspectionHistory);
    if (histScore >= 70) commonFactors.push('similar_pass_rate');
  } else {
    missingFactors.push('inspection_history');
  }

  // 7 & 8. Complaints (5%) and Repairs (5%) are unavailable -> skipped & missing

  // Renormalize available weight
  const finalScore = availableWeightTotal.gt(0)
    ? weightedSum.dividedBy(availableWeightTotal).toDecimalPlaces(2).toNumber()
    : 0;

  const totalPossibleFactors = 8;
  const availableFactorsCount = totalPossibleFactors - missingFactors.length;
  const dataCoverage = Math.round((availableFactorsCount / totalPossibleFactors) * 100);

  return {
    similarityScore: finalScore,
    distanceKm,
    commonFactors,
    missingFactors,
    dataCoverage
  };
}
