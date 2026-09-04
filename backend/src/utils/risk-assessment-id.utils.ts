import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Risk Assessment ID in the format:
 * RAS-{YYYY}-{00001}
 * e.g., RAS-2026-00001
 */
export const generateRiskAssessmentId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `RAS-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${counterKey}-${paddedSeq}`;
};
