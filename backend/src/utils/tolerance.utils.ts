import Decimal from 'decimal.js';
import { IToleranceRule } from '../models/tolerance-rule.model';
import { IToleranceSnapshot, CalculatedAssessment } from '../models/inspection.model';
import { ToleranceRule } from '../models/tolerance-rule.model';

export interface DeviationResult {
  deviation: number;
  deviationPercentage: number | null;
  calculatedAssessment: CalculatedAssessment;
  toleranceSnapshot: IToleranceSnapshot;
}

/** Centralized precision policy for stored/displayed outputs */
export const DISPLAY_PRECISION = 6;

/**
 * Finds the applicable tolerance rule deterministically, even if legacy or
 * overlapping active rules exist, using explicit ordered tie-breakers:
 * 1. Specificity: Narrower capacity range first (capacityMax - capacityMin ASC)
 * 2. Version: Higher version number first (version DESC)
 * 3. Effective date: More recent effective date first (effectiveFrom DESC)
 * 4. Creation date: Most recently created first (createdAt DESC)
 * 5. Deterministic ID fallback (_id DESC)
 */
export const findApplicableRule = async (
  instrumentType: string,
  instrumentCategory: string,
  capacityValue: number,
  capacityUnit: string
): Promise<IToleranceRule | null> => {
  const now = new Date();

  const candidates = await ToleranceRule.find({
    instrumentType: instrumentType.trim(),
    instrumentCategory: instrumentCategory.trim(),
    capacityUnit: capacityUnit.trim(),
    capacityMin: { $lte: capacityValue },
    capacityMax: { $gte: capacityValue },
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }]
  });

  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Deterministic tie-breaker sort
  candidates.sort((a, b) => {
    // 1. Specificity: narrower capacity range first
    const spanA = a.capacityMax - a.capacityMin;
    const spanB = b.capacityMax - b.capacityMin;
    if (spanA !== spanB) {
      return spanA - spanB;
    }

    // 2. Version DESC
    if (b.version !== a.version) {
      return b.version - a.version;
    }

    // 3. Effective date DESC
    const effectiveA = a.effectiveFrom ? a.effectiveFrom.getTime() : 0;
    const effectiveB = b.effectiveFrom ? b.effectiveFrom.getTime() : 0;
    if (effectiveB !== effectiveA) {
      return effectiveB - effectiveA;
    }

    // 4. Creation date DESC
    const createdA = a.createdAt ? a.createdAt.getTime() : 0;
    const createdB = b.createdAt ? b.createdAt.getTime() : 0;
    if (createdB !== createdA) {
      return createdB - createdA;
    }

    // 5. Explicit ID fallback
    return b._id.toString().localeCompare(a._id.toString());
  });

  return candidates[0];
};

/**
 * Calculates deviation, deviationPercentage, and tolerance assessment.
 *
 * Rules:
 * - Uses decimal-safe arithmetic (decimal.js).
 * - Never rounds deviation before percentage calculation or tolerance comparison.
 * - Tolerance comparison is performed against unrounded precise values.
 * - Centralized rounding is applied ONLY to output values for storage/display.
 * - Preserves signed deviation (actual - reference).
 * - Division by zero prevented: if referenceReading === 0, deviationPercentage is null.
 * - Boundary condition: |deviation| <= allowed is WITHIN_TOLERANCE; |deviation| > allowed is OUTSIDE_TOLERANCE.
 */
export const calculateDeviation = (
  referenceReading: number,
  actualReading: number,
  rule: IToleranceRule
): DeviationResult => {
  const dRef = new Decimal(referenceReading);
  const dActual = new Decimal(actualReading);

  // Unrounded precise deviation: actual - reference (signed)
  const dDeviation = dActual.minus(dRef);

  // Unrounded precise percentage: (deviation / reference) * 100
  let dDeviationPct: Decimal | null = null;
  if (!dRef.isZero()) {
    dDeviationPct = dDeviation.dividedBy(dRef).times(100);
  }

  // Precise allowed deviation
  const dAbsDeviation = dDeviation.abs();
  const dToleranceVal = new Decimal(rule.toleranceValue);

  let dAllowedDeviation: Decimal;
  if (rule.toleranceMode === 'ABSOLUTE') {
    dAllowedDeviation = dToleranceVal;
  } else {
    // PERCENTAGE: (|ref| * toleranceValue) / 100
    dAllowedDeviation = dRef.abs().times(dToleranceVal).dividedBy(100);
  }

  // Exact unrounded comparison for boundaries:
  // just inside (<), exactly on (==), just outside (>)
  const calculatedAssessment: CalculatedAssessment =
    dAbsDeviation.lessThanOrEqualTo(dAllowedDeviation)
      ? 'WITHIN_TOLERANCE'
      : 'OUTSIDE_TOLERANCE';

  // Apply centralized precision policy only to values returned for storage/display
  const roundedDeviation = dDeviation
    .toDecimalPlaces(DISPLAY_PRECISION, Decimal.ROUND_HALF_UP)
    .toNumber();

  const roundedDeviationPct = dDeviationPct
    ? dDeviationPct.toDecimalPlaces(DISPLAY_PRECISION, Decimal.ROUND_HALF_UP).toNumber()
    : null;

  const toleranceSnapshot: IToleranceSnapshot = {
    ruleId: rule.ruleId,
    name: rule.name,
    toleranceMode: rule.toleranceMode,
    toleranceValue: rule.toleranceValue,
    capacityUnit: rule.capacityUnit
  };

  return {
    deviation: roundedDeviation,
    deviationPercentage: roundedDeviationPct,
    calculatedAssessment,
    toleranceSnapshot
  };
};
