import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Verification Request ID in the format:
 * VRF-{YYYY}-{00001}
 * e.g., VRF-2026-00001
 *
 * Uses the atomic MongoDB counter pattern with duplicate-key race retries
 * to ensure no duplicate IDs are generated even under heavy concurrent load.
 */
export const generateVerificationRequestId = async (date: Date = new Date()): Promise<string> => {
  const year = date.getFullYear();
  const counterKey = `VRF-${year}`;
  const seq = await getNextSequence(counterKey);
  const paddedSeq = String(seq).padStart(5, '0');

  return `${counterKey}-${paddedSeq}`;
};
