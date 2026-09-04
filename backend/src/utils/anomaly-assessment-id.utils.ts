import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Anomaly Assessment ID in the format:
 * ANO-{YYYY}-{00001}
 * e.g., ANO-2026-00001
 */
export const generateAnomalyAssessmentId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `ANO-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${counterKey}-${paddedSeq}`;
};
