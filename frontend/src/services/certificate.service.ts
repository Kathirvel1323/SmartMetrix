import { apiClient } from './api';
import type { Certificate } from '../types';

export interface CertificatePolicy {
  _id: string;
  policyId: string;
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  validityPeriodMonths: number;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
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
    return response.data?.data?.certificates || [];
  },

  /**
   * GET /api/certificates/:certificateNumber
   */
  async getCertificate(certificateNumber: string): Promise<Certificate> {
    const response = await apiClient.get(`/certificates/${certificateNumber}`);
    return response.data?.data?.certificate;
  },

  /**
   * POST /api/certificates/issue (ADMIN)
   */
  async issueCertificate(payload: { verificationRequestId: string }): Promise<Certificate> {
    const response = await apiClient.post('/certificates/issue', payload);
    return response.data?.data?.certificate;
  },

  /**
   * POST /api/certificates/:certificateNumber/revoke (ADMIN)
   */
  async revokeCertificate(certificateNumber: string, reason: string): Promise<Certificate> {
    const response = await apiClient.post(`/certificates/${certificateNumber}/revoke`, { reason });
    return response.data?.data?.certificate;
  },

  // Policies (ADMIN / INSPECTOR)
  async listPolicies(): Promise<CertificatePolicy[]> {
    const response = await apiClient.get('/certificates/policies');
    return response.data?.data?.policies || [];
  },

  async createPolicy(payload: { name: string; instrumentType: string; instrumentCategory: string; validityPeriodMonths: number }): Promise<CertificatePolicy> {
    const response = await apiClient.post('/certificates/policies', payload);
    return response.data?.data?.policy;
  },

  async activatePolicy(policyId: string): Promise<CertificatePolicy> {
    const response = await apiClient.post(`/certificates/policies/${policyId}/activate`, {});
    return response.data?.data?.policy;
  },

  async deactivatePolicy(policyId: string): Promise<CertificatePolicy> {
    const response = await apiClient.post(`/certificates/policies/${policyId}/deactivate`, {});
    return response.data?.data?.policy;
  }
};
