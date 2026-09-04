import { getNextSequence } from '../models/counter.model';

export async function generatePhotoAssistId(): Promise<string> {
  const seq = await getNextSequence('photoAssistId');
  return `PAA-${seq.toString().padStart(4, '0')}`;
}

export async function generatePredictiveId(): Promise<string> {
  const seq = await getNextSequence('predictiveId');
  return `PDA-${seq.toString().padStart(4, '0')}`;
}

export async function generateVerificationRuleId(): Promise<string> {
  const seq = await getNextSequence('verificationRuleId');
  return `VRR-${seq.toString().padStart(4, '0')}`;
}
