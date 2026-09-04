import { apiClient } from './api';
import type { DashboardKpis } from '../types';

export const analyticsService = {
  async getDashboardKpis(): Promise<DashboardKpis> {
    const response = await apiClient.get('/analytics/dashboard');
    // Backend returns: { status: 'success', data: { kpis: { totalInstruments, ... } } }
    const data = response.data?.data || response.data;
    return data?.kpis || data;
  },

  async getRiskDistribution(): Promise<any[]> {
    const response = await apiClient.get('/analytics/risk-distribution');
    return response.data?.data || [];
  },

  async getPassFailTrends(): Promise<any[]> {
    const response = await apiClient.get('/analytics/pass-fail-trends');
    return response.data?.data || [];
  },

  async getVerificationDistribution(): Promise<any[]> {
    const response = await apiClient.get('/analytics/verification-distribution');
    return response.data?.data || [];
  },

  async getPriorityInspections(): Promise<any[]> {
    const response = await apiClient.get('/analytics/priority-inspections');
    return response.data?.data || [];
  },

  async getAnomalyAndClusterCounts(): Promise<any> {
    const response = await apiClient.get('/analytics/anomaly-cluster-counts');
    return response.data?.data || {};
  },

  async getCertificateValidity(): Promise<any[]> {
    const response = await apiClient.get('/analytics/certificate-validity');
    return response.data?.data || [];
  },

  async getImprovementNoticeStatus(): Promise<any[]> {
    const response = await apiClient.get('/analytics/improvement-notice-status');
    return response.data?.data || [];
  },
};
