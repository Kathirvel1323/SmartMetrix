import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Tolerance Rule ID in the format:
 * TLR-{YYYY}-{00001}
 * e.g., TLR-2026-00001
 */
export const generateToleranceRuleId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `TLR-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${counterKey}-${paddedSeq}`;
};
