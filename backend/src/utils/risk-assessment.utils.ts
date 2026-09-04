/**
 * risk-assessment.utils.ts
 *
 * Explainable Risk Score and Trust Score calculation utilities.
 *
 * Design principles:
 * - Scores are DECISION SUPPORT ONLY. They never override statutory PASS/FAIL
 *   decisions or instrument legal status, and must never describe confirmed fraud,
 *   tampering, or defects.
 * - Missing data is made explicit. Factors with no real data (complaints, repairs,
 *   calibration issues, regional risk, age) are marked available=false and are
 *   NEVER fabricated.
 * - Missing data strategy:
 *     RENORMALIZE (default): Available factor weights are renormalized to sum to 100.
 *       Missing factors contribute 0 points.
 *     ZERO: Missing factors are treated as 0 normalized value before weighting.
 *       The total score is out of the full configured weight total (100).
 * - Data coverage = (sum of weights of available factors) / 100
 */

import Decimal from 'decimal.js';
import { IRiskConfiguration, RiskLevel, MissingDataStrategy } from '../models/risk-config.model';
import { IRiskFactor, ITrustFactor, TrustLevel } from '../models/risk-assessment.model';
import { IInstrument } from '../models/instrument.model';

export interface InspectionStats {
  total: number;
  passed: number;
  failed: number;
  outsideTolerance: number;
  meanAbsDeviationPct: number | null;
  hasData: boolean;
}

export interface RiskScoreResult {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: IRiskFactor[];
  missingFactors: string[];
  dataCoverage: number;
  recommendedAction: string;
  disclaimer: string;
}

export interface TrustScoreResult {
  trustScore: number;
  trustLevel: TrustLevel;
  trustFactors: ITrustFactor[];
  trustDataCoverage: number;
  trustExplanation: string;
}

/** Clamp a value between min and max, inclusive. */
const clamp = (v: number, min = 0, max = 100): number => Math.max(min, Math.min(max, v));

/**
 * Determine risk level from score using configured thresholds.
 */
export const getRiskLevel = (score: number, config: IRiskConfiguration): RiskLevel => {
  const t = config.thresholds;
  if (score <= t.LOW.max) return 'LOW';
  if (score <= t.MEDIUM.max) return 'MEDIUM';
  if (score <= t.HIGH.max) return 'HIGH';
  return 'CRITICAL';
};

/**
 * Returns a recommended action string based on risk level.
 * This is informational guidance only, not a legal determination.
 */
export const getRecommendedAction = (level: RiskLevel): string => {
  switch (level) {
    case 'LOW':
      return 'No immediate action required. Continue standard periodic verification schedule.';
    case 'MEDIUM':
      return 'Monitor instrument closely. Consider scheduling the next verification ahead of the standard cycle.';
    case 'HIGH':
      return 'Prioritise for early verification. Review inspection history and instrument condition.';
    case 'CRITICAL':
      return 'Immediate attention recommended. Escalate for expedited verification and thorough inspection review.';
  }
};

/**
 * Determines trust level from score.
 * Separate from risk levels — thresholds are simpler fixed bands.
 */
export const getTrustLevel = (score: number): TrustLevel => {
  if (score >= 75) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  if (score >= 0) return 'LOW';
  return 'UNKNOWN';
};

/**
 * Normalize a raw value (higher = riskier) to 0–1 range using a linear mapping.
 * rawMin and rawMax define the expected domain for the factor.
 */
const normalizeLinear = (raw: number, rawMin: number, rawMax: number): number => {
  if (rawMax <= rawMin) return 0;
  return clamp((raw - rawMin) / (rawMax - rawMin), 0, 1);
};

/**
 * Calculate Risk Score and Trust Score from genuine instrument and inspection data.
 *
 * @param instrument - the Instrument Mongoose document
 * @param stats - aggregated inspection statistics from real DB records
 * @param config - the active RiskConfiguration
 * @returns both risk and trust score results
 */
export const calculateRiskScore = (
  instrument: IInstrument,
  stats: InspectionStats,
  config: IRiskConfiguration
): RiskScoreResult => {
  const strategy: MissingDataStrategy = config.missingDataStrategy;
  const weights = config.weights;

  // --- Factor availability and raw values ---
  // Each factor is computed from real DB data only. MISSING means data is unavailable.

  type FactorKey = keyof typeof weights;
  interface FactorRaw {
    key: FactorKey;
    available: boolean;
    rawValue: number | null;
    normalizedValue: number | null;
  }

  const factorRaws: FactorRaw[] = [];

  // 1. deviation — mean absolute deviation percentage (higher = riskier)
  factorRaws.push({
    key: 'deviation',
    available: stats.hasData && stats.meanAbsDeviationPct !== null,
    rawValue: stats.meanAbsDeviationPct,
    normalizedValue:
      stats.hasData && stats.meanAbsDeviationPct !== null
        ? normalizeLinear(stats.meanAbsDeviationPct, 0, 10) // 0–10% is the domain
        : null
  });

  // 2. failedInspections — ratio (0–1) of failed inspections (higher = riskier)
  const failedRatio = stats.total > 0 ? stats.failed / stats.total : null;
  factorRaws.push({
    key: 'failedInspections',
    available: stats.hasData,
    rawValue: failedRatio,
    normalizedValue: stats.hasData && failedRatio !== null ? clamp(failedRatio, 0, 1) : null
  });

  // 3. nonComplianceHistory — ratio of OUTSIDE_TOLERANCE assessments (higher = riskier)
  const nonComplianceRatio = stats.total > 0 ? stats.outsideTolerance / stats.total : null;
  factorRaws.push({
    key: 'nonComplianceHistory',
    available: stats.hasData,
    rawValue: nonComplianceRatio,
    normalizedValue: stats.hasData && nonComplianceRatio !== null ? clamp(nonComplianceRatio, 0, 1) : null
  });

  // 4. overdueCertificate — 1 if expired/absent, 0 if valid (binary, 1 = riskier)
  const cert = (instrument as any).currentCertificate;
  let certAvailable = false;
  let certNormalized: number | null = null;
  let certRaw: number | null = null;
  if (cert && cert.expiryDate) {
    certAvailable = true;
    const isExpired = new Date(cert.expiryDate) < new Date();
    certRaw = isExpired ? 1 : 0;
    certNormalized = certRaw; // already 0 or 1
  }
  factorRaws.push({
    key: 'overdueCertificate',
    available: certAvailable,
    rawValue: certRaw,
    normalizedValue: certNormalized
  });

  // 5–9: complaints, repairs, calibrationIssues, regionalRisk, age
  // These factors are NOT available — the system has no data models for them.
  // They are marked explicitly unavailable and never fabricated.
  for (const key of ['complaints', 'repairs', 'calibrationIssues', 'regionalRisk', 'age'] as FactorKey[]) {
    factorRaws.push({ key, available: false, rawValue: null, normalizedValue: null });
  }

  // --- Compute effective weights and contributions ---
  const availableFactors = factorRaws.filter((f) => f.available);
  const totalAvailableWeight = availableFactors.reduce(
    (sum, f) => new Decimal(sum).plus(weights[f.key]).toNumber(),
    0
  );
  const dataCoverage = clamp(
    totalAvailableWeight / 100,
    0,
    1
  );

  const riskFactors: IRiskFactor[] = factorRaws.map((f) => {
    const configuredWeight = weights[f.key];
    let effectiveWeight: number;

    if (!f.available) {
      effectiveWeight = 0;
    } else if (strategy === 'RENORMALIZE') {
      // Scale available weights proportionally to sum to 100
      effectiveWeight =
        totalAvailableWeight > 0
          ? new Decimal(configuredWeight).dividedBy(totalAvailableWeight).times(100).toDecimalPlaces(6).toNumber()
          : 0;
    } else {
      // ZERO strategy: use configured weight as-is
      effectiveWeight = configuredWeight;
    }

    const contribution =
      f.available && f.normalizedValue !== null
        ? new Decimal(effectiveWeight).times(f.normalizedValue).toDecimalPlaces(6).toNumber()
        : 0;

    return {
      factor: f.key,
      available: f.available,
      rawValue: f.rawValue,
      normalizedValue: f.normalizedValue,
      configuredWeight,
      effectiveWeight,
      contribution
    };
  });

  // Sum contributions to get raw score
  const rawScore = riskFactors.reduce(
    (sum, f) => new Decimal(sum).plus(f.contribution).toNumber(),
    0
  );
  const riskScore = clamp(
    new Decimal(rawScore).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
  );

  const riskLevel = getRiskLevel(riskScore, config);
  const missingFactors = factorRaws.filter((f) => !f.available).map((f) => f.key);
  const recommendedAction = getRecommendedAction(riskLevel);

  const disclaimer =
    'This score is decision support only. It does not constitute a legal determination, ' +
    'confirm fraud or tampering, or override the statutory PASS/FAIL result issued by the ' +
    'assigned authorized inspector. Scores are based on available system data only.';

  return { riskScore, riskLevel, riskFactors, missingFactors, dataCoverage, recommendedAction, disclaimer };
};

/**
 * Calculate Trust Score — a separate index of instrument reliability.
 *
 * Trust is computed from genuine inspection records only:
 * - Positive: pass rate, has been inspected, low mean deviation, valid certificate
 * - Negative: fail rate, high deviation inspections, override/mismatch ratio
 *
 * Trust and Risk are intentionally independent.
 */
export const calculateTrustScore = (
  instrument: IInstrument,
  stats: InspectionStats
): TrustScoreResult => {
  const trustFactors: ITrustFactor[] = [];
  let totalPositive = 0;
  let totalNegative = 0;
  let availableWeight = 0;

  if (!stats.hasData) {
    // No inspection history at all — trust is unknown
    return {
      trustScore: 0,
      trustLevel: 'UNKNOWN',
      trustFactors: [{
        factor: 'noInspectionHistory',
        available: false,
        value: null,
        impact: 'NEGATIVE',
        contribution: 0,
        explanation: 'No finalized inspection records found for this instrument. Trust cannot be established.'
      }],
      trustDataCoverage: 0,
      trustExplanation:
        'Trust score could not be calculated: no finalized inspection history exists. ' +
        'This does not indicate a problem — the instrument may simply have no completed verifications on record.'
    };
  }

  // Factor 1: Pass rate (POSITIVE, weight 40)
  const passRate = stats.total > 0 ? stats.passed / stats.total : 0;
  const passContrib = new Decimal(40).times(passRate).toDecimalPlaces(2).toNumber();
  totalPositive += passContrib;
  availableWeight += 40;
  trustFactors.push({
    factor: 'passRate',
    available: true,
    value: Math.round(passRate * 100) / 100,
    impact: 'POSITIVE',
    contribution: passContrib,
    explanation: `${stats.passed} of ${stats.total} finalized inspections resulted in PASS (${(passRate * 100).toFixed(1)}%).`
  });

  // Factor 2: Non-compliance ratio (NEGATIVE, weight 25)
  const nonCompRate = stats.total > 0 ? stats.outsideTolerance / stats.total : 0;
  const nonCompContrib = new Decimal(25).times(nonCompRate).toDecimalPlaces(2).toNumber();
  totalNegative += nonCompContrib;
  availableWeight += 25;
  trustFactors.push({
    factor: 'nonComplianceRatio',
    available: true,
    value: Math.round(nonCompRate * 100) / 100,
    impact: 'NEGATIVE',
    contribution: nonCompContrib,
    explanation: `${stats.outsideTolerance} of ${stats.total} inspections had readings outside tolerance (${(nonCompRate * 100).toFixed(1)}%).`
  });

  // Factor 3: Precision — low mean deviation is positive (POSITIVE, weight 20)
  if (stats.meanAbsDeviationPct !== null) {
    // Precision score: 1 if deviation=0, decreases linearly to 0 at 10%
    const precisionScore = clamp(1 - stats.meanAbsDeviationPct / 10, 0, 1);
    const precContrib = new Decimal(20).times(precisionScore).toDecimalPlaces(2).toNumber();
    totalPositive += precContrib;
    availableWeight += 20;
    trustFactors.push({
      factor: 'meanDeviationPrecision',
      available: true,
      value: Math.round(stats.meanAbsDeviationPct * 10000) / 10000,
      impact: 'POSITIVE',
      contribution: precContrib,
      explanation: `Mean absolute deviation of ${stats.meanAbsDeviationPct.toFixed(4)}% across ${stats.total} inspection(s). Lower deviation indicates higher precision.`
    });
  } else {
    trustFactors.push({
      factor: 'meanDeviationPrecision',
      available: false,
      value: null,
      impact: 'POSITIVE',
      contribution: 0,
      explanation: 'Deviation percentage could not be calculated (reference reading may be zero).'
    });
  }

  // Factor 4: Valid certificate (POSITIVE, weight 15) — only if cert data exists
  const cert = (instrument as any).currentCertificate;
  if (cert && cert.expiryDate) {
    const isValid = new Date(cert.expiryDate) >= new Date();
    const certContrib = isValid ? 15 : 0;
    totalPositive += certContrib;
    availableWeight += 15;
    trustFactors.push({
      factor: 'validCertificate',
      available: true,
      value: isValid ? 1 : 0,
      impact: 'POSITIVE',
      contribution: certContrib,
      explanation: isValid
        ? `Current certificate is valid (expires: ${new Date(cert.expiryDate).toISOString().split('T')[0]}).`
        : `Current certificate has expired (expired: ${new Date(cert.expiryDate).toISOString().split('T')[0]}).`
    });
  } else {
    trustFactors.push({
      factor: 'validCertificate',
      available: false,
      value: null,
      impact: 'POSITIVE',
      contribution: 0,
      explanation: 'No certificate data recorded for this instrument. Certificate factor not available.'
    });
  }

  // Compute trust score: positives - negatives, clamped 0–100
  const rawTrust = totalPositive - totalNegative;
  const trustScore = clamp(
    new Decimal(rawTrust).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
  );
  const trustLevel = getTrustLevel(trustScore);
  const trustDataCoverage = clamp(availableWeight / 100, 0, 1);

  const trustExplanation =
    `Trust score of ${trustScore}/100 (${trustLevel}) based on ${stats.total} finalized inspection(s). ` +
    `Pass rate: ${(passRate * 100).toFixed(1)}%, Non-compliance rate: ${(nonCompRate * 100).toFixed(1)}%. ` +
    (stats.meanAbsDeviationPct !== null
      ? `Mean deviation: ${stats.meanAbsDeviationPct.toFixed(4)}%. `
      : '') +
    'This is decision-support information only.';

  return { trustScore, trustLevel, trustFactors, trustDataCoverage, trustExplanation };
};
