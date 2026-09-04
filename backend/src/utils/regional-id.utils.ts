import { getNextSequence } from '../models/counter.model';

export async function generateRegionalConfigId(): Promise<string> {
  const seq = await getNextSequence('regionalConfigId');
  return `RGC-${seq.toString().padStart(4, '0')}`;
}

export async function generateRegionalAssessmentId(): Promise<string> {
  const seq = await getNextSequence('regionalAssessmentId');
  return `RGA-${seq.toString().padStart(4, '0')}`;
}
