import { apiClient } from './api';
import type { RiskPriority, RiskConfiguration } from '../types';

export const riskService = {
  /**
   * GET /api/risk/priorities
   * Returns instruments ranked by latest risk score (ADMIN, INSPECTOR only).
   * Response: { status, data: { priorities: [...] } }
   */
  async getPriorityList(): Promise<RiskPriority[]> {
    const response = await apiClient.get('/risk/priorities');
    return response.data?.data?.priorities || [];
  },

  /**
   * GET /api/risk/configurations/active
   * Returns the currently active risk configuration (ADMIN, INSPECTOR).
   * Response: { status, data: { configuration: {...} } }
   */
  async getActiveConfiguration(): Promise<RiskConfiguration | null> {
    const response = await apiClient.get('/risk/configurations/active');
    return response.data?.data?.configuration || null;
  },

  /**
   * GET /api/risk/configurations
   * Returns all risk configurations (ADMIN only).
   * Response: { status, data: { configurations: [...] } }
   */
  async listConfigurations(): Promise<RiskConfiguration[]> {
    const response = await apiClient.get('/risk/configurations');
    return response.data?.data?.configurations || [];
  },
};
