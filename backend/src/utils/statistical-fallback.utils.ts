/**
 * Statistical Fallback Utility for Anomaly Detection
 * Deterministic Z-score / interquartile range statistical analysis
 * Used when the FastAPI AI Service is unreachable or times out.
 * Clearly labeled as DETERMINISTIC_STATISTICAL_FALLBACK.
 */

import Decimal from 'decimal.js';

export interface StatisticalMetric {
  feature: string;
  value: number | null;
  mean: number;
  stdDev: number;
  zScore: number | null;
  isOutlier: boolean;
}

export interface StatisticalFallbackResult {
  potentialAnomaly: boolean;
  anomalyScore: number;
  confidence: number;
  contributingFactors: string[];
  metrics: StatisticalMetric[];
}

export const computeStatisticalFallback = (
  targetFeatures: Record<string, number | null>,
  sampleFeatures: Array<Record<string, number | null>>
): StatisticalFallbackResult => {
  const metrics: StatisticalMetric[] = [];
  const contributingFactors: string[] = [];

  const featureKeys = Object.keys(targetFeatures).sort();
  let validFeaturesCount = 0;
  let totalScoreSum = new Decimal(0);

  for (const feat of featureKeys) {
    const targetVal = targetFeatures[feat];
    if (targetVal === null || targetVal === undefined || !isFinite(targetVal)) {
      continue;
    }

    // Collect finite values across samples
    const values = sampleFeatures
      .map((s) => s[feat])
      .filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (values.length === 0) {
      continue;
    }

    validFeaturesCount++;

    // Calculate mean
    const sum = values.reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0));
    const mean = sum.dividedBy(values.length).toNumber();

    // Calculate variance and std dev
    const varSum = values.reduce(
      (acc, v) => acc.plus(new Decimal(v).minus(mean).pow(2)),
      new Decimal(0)
    );
    const variance = values.length > 1 ? varSum.dividedBy(values.length - 1).toNumber() : 0;
    const stdDev = Math.sqrt(variance);

    let zScore: number | null = null;
    let isOutlier = false;

    if (stdDev > 0) {
      zScore = Math.abs(targetVal - mean) / stdDev;
      if (zScore >= 2.0) {
        isOutlier = true;
        contributingFactors.push(feat);
      }
    } else {
      // If zero variance and targetVal != mean, it's anomalous
      if (Math.abs(targetVal - mean) > 1e-6) {
        isOutlier = true;
        zScore = 3.0;
        contributingFactors.push(feat);
      } else {
        zScore = 0;
      }
    }

    // Individual feature score: normalized sigmoid-like or capped z-score / 3.0
    const featScore = Math.min(1.0, (zScore || 0) / 3.0);
    totalScoreSum = totalScoreSum.plus(featScore);

    metrics.push({
      feature: feat,
      value: targetVal,
      mean: Math.round(mean * 10000) / 10000,
      stdDev: Math.round(stdDev * 10000) / 10000,
      zScore: zScore !== null ? Math.round(zScore * 10000) / 10000 : null,
      isOutlier
    });
  }

  const anomalyScore =
    validFeaturesCount > 0
      ? totalScoreSum.dividedBy(validFeaturesCount).toDecimalPlaces(4).toNumber()
      : 0;

  const potentialAnomaly = contributingFactors.length > 0 || anomalyScore >= 0.6;
  const confidence = Math.min(1.0, Math.max(0.5, validFeaturesCount / 6));

  return {
    potentialAnomaly,
    anomalyScore: Math.min(1.0, Math.max(0.0, anomalyScore)),
    confidence: Math.round(confidence * 100) / 100,
    contributingFactors,
    metrics
  };
};
