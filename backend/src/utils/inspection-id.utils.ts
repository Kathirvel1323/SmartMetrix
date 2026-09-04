import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Inspection ID in the format:
 * INS-{YYYY}-{00001}
 * e.g., INS-2026-00001
 *
 * Uses the atomic MongoDB counter pattern with duplicate-key race retries.
 */
export const generateInspectionId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `INS-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${counterKey}-${paddedSeq}`;
};
