import { getNextSequence } from '../models/counter.model';

export async function generatePolicyId(): Promise<string> {
  const seq = await getNextSequence('certificatePolicyId');
  return `POL-${seq.toString().padStart(4, '0')}`;
}

export async function generateCertificateNumber(year: number = new Date().getFullYear()): Promise<string> {
  const seq = await getNextSequence(`cert_${year}`);
  return `CERT-${year}-${seq.toString().padStart(5, '0')}`;
}

export async function generateComplaintId(): Promise<string> {
  const seq = await getNextSequence('complaintId');
  return `CMP-${seq.toString().padStart(4, '0')}`;
}

export async function generateNoticeId(): Promise<string> {
  const seq = await getNextSequence('noticeId');
  return `IMP-${seq.toString().padStart(4, '0')}`;
}
