import { apiClient } from './api';
import type { DashboardKpis } from '../types';

export const analyticsService = {
  async getDashboardKpis(): Promise<DashboardKpis> {
    const response = await apiClient.get<DashboardKpis>('/analytics/dashboard');
    return response.data;
  },

  async getRiskDistribution(): Promise<any> {
    const response = await apiClient.get('/analytics/risk-distribution');
    return response.data;
  },

  async getPassFailTrends(): Promise<any> {
    const response = await apiClient.get('/analytics/pass-fail-trends');
    return response.data;
  },

  async getVerificationDistribution(): Promise<any> {
    const response = await apiClient.get('/analytics/verification-distribution');
    return response.data;
  },

  async getPriorityInspections(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/analytics/priority-inspections');
    return response.data;
  }
};
