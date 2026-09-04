import { resolveRegionCode } from './region.utils';
import { getNextSequence } from '../models/counter.model';

/**
 * Generates an atomic, collision-free Instrument ID in the format:
 * WM-{REGION}-{00000}
 * e.g., WM-MDU-00102
 */
export const generateInstrumentId = async (
  city?: string,
  district?: string,
  state?: string
): Promise<string> => {
  const regionCode = resolveRegionCode(city, district, state);
  const key = `WM-${regionCode}`;
  const seq = await getNextSequence(key);
  const paddedSeq = String(seq).padStart(5, '0');

  return `${key}-${paddedSeq}`;
};
