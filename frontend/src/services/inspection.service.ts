import { apiClient } from './api';
import type { Inspection } from '../types';

export const inspectionService = {
  async getInspections(params?: { inspectorResult?: 'PASS' | 'FAIL' | ''; page?: number; limit?: number }): Promise<{ inspections: Inspection[]; total: number; page: number; totalPages: number }> {
    const response = await apiClient.get('/inspections', { params });
    const resBody = response.data;
    const items = resBody.data || resBody.inspections || (Array.isArray(resBody) ? resBody : []);
    const pagination = resBody.pagination || {};
    return {
      inspections: items,
      total: pagination.total || items.length,
      page: pagination.page || 1,
      totalPages: pagination.totalPages || 1,
    };
  },

  async getInspectionById(inspectionId: string): Promise<Inspection> {
    const response = await apiClient.get(`/inspections/${inspectionId}`);
    return response.data?.data?.inspection || response.data?.inspection || response.data;
  },

  async submitInspection(formData: FormData): Promise<Inspection> {
    const response = await apiClient.post('/inspections', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data?.data?.inspection || response.data?.inspection || response.data;
  }
};
