import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Risk Configuration ID in the format:
 * RSK-{YYYY}-{00001}
 * e.g., RSK-2026-00001
 */
export const generateRiskConfigId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `RSK-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${counterKey}-${paddedSeq}`;
};
