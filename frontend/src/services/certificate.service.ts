import { apiClient } from './api';
import type { Certificate } from '../types';

export interface CertificatePolicy {
  _id: string;
  policyId: string;
  category: string;
  validityMonths: number;
  gracePeriodDays: number;
  requireDigitalSignature: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
}

export const certificateService = {
  /**
   * GET /api/certificates
   */
  async listCertificates(): Promise<Certificate[]> {
    const response = await apiClient.get('/certificates');
    return response.data?.certificates || response.data || [];
  },

  /**
   * GET /api/certificates/:certificateNumber
   */
  async getCertificate(certificateNumber: string): Promise<Certificate> {
    const response = await apiClient.get(`/certificates/${certificateNumber}`);
    return response.data?.certificate || response.data;
  },

  /**
   * POST /api/certificates/issue (ADMIN)
   */
  async issueCertificate(payload: { inspectionId: string; customValidityMonths?: number }): Promise<Certificate> {
    const response = await apiClient.post('/certificates/issue', payload);
    return response.data?.certificate || response.data;
  },

  /**
   * POST /api/certificates/:certificateNumber/revoke (ADMIN)
   */
  async revokeCertificate(certificateNumber: string, reason: string): Promise<Certificate> {
    const response = await apiClient.post(`/certificates/${certificateNumber}/revoke`, { reason });
    return response.data?.certificate || response.data;
  },

  // Policies (ADMIN / INSPECTOR)
  async listPolicies(): Promise<CertificatePolicy[]> {
    const response = await apiClient.get('/certificates/policies');
    return response.data?.policies || response.data || [];
  },

  async createPolicy(payload: { category: string; validityMonths: number; gracePeriodDays: number; requireDigitalSignature?: boolean }): Promise<CertificatePolicy> {
    const response = await apiClient.post('/certificates/policies', payload);
    return response.data?.policy || response.data;
  },

  async activatePolicy(policyId: string): Promise<CertificatePolicy> {
    const response = await apiClient.post(`/certificates/policies/${policyId}/activate`, {});
    return response.data?.policy || response.data;
  },

  async deactivatePolicy(policyId: string): Promise<CertificatePolicy> {
    const response = await apiClient.post(`/certificates/policies/${policyId}/deactivate`, {});
    return response.data?.policy || response.data;
  }
};
