import { apiClient } from './api';
import type { VerificationRequest } from '../types';

export const verificationService = {
  async getVerificationRequests(params?: { status?: string; page?: number; limit?: number }): Promise<{ requests: VerificationRequest[]; total: number; page: number; totalPages: number }> {
    const response = await apiClient.get('/verifications', { params });
    const resBody = response.data;
    const items = resBody.data || resBody.requests || (Array.isArray(resBody) ? resBody : []);
    const pagination = resBody.pagination || {};
    return {
      requests: items,
      total: pagination.total || items.length,
      page: pagination.page || 1,
      totalPages: pagination.totalPages || 1,
    };
  },

  async getVerificationRequestById(requestId: string): Promise<VerificationRequest> {
    const response = await apiClient.get(`/verifications/${requestId}`);
    return response.data?.data?.verification || response.data?.verification || response.data;
  },

  async createVerificationRequest(data: { instrumentId: string; notes?: string }): Promise<VerificationRequest> {
    const response = await apiClient.post('/verifications', data);
    return response.data?.data?.verification || response.data?.verification || response.data;
  },

  async reviewVerificationRequest(requestId: string): Promise<VerificationRequest> {
    const response = await apiClient.patch(`/verifications/${requestId}/review`);
    return response.data?.data?.verification || response.data?.verification || response.data;
  },

  async assignInspector(requestId: string, data: { inspectorId: string }): Promise<VerificationRequest> {
    const response = await apiClient.patch(`/verifications/${requestId}/assign`, data);
    return response.data?.data?.verification || response.data?.verification || response.data;
  },

  async scheduleVerification(requestId: string, data: { scheduledAt: string; estimatedDurationMinutes?: number }): Promise<VerificationRequest> {
    const response = await apiClient.patch(`/verifications/${requestId}/schedule`, data);
    return response.data?.data?.verification || response.data?.verification || response.data;
  }
};
