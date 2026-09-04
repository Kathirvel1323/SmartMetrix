import { apiClient } from './api';
import type { AnomalyAssessment } from '../types';

export const anomalyService = {
  /**
   * GET /api/anomaly/potential-anomalies
   * Returns all instruments with potentialAnomaly === true in their latest assessment.
   * Sorted by anomalyScore descending. ADMIN and INSPECTOR only.
   * Response: { status, data: { potentialAnomalies: [...] } }
   */
  async getPotentialAnomalies(): Promise<AnomalyAssessment[]> {
    const response = await apiClient.get('/anomaly/potential-anomalies');
    return response.data?.data?.potentialAnomalies || [];
  },

  /**
   * GET /api/anomaly/instruments/:instrumentId/latest
   * Returns the latest anomaly assessment for a specific instrument.
   * Response: { status, data: { assessment: {...} } }
   */
  async getLatestAssessment(instrumentId: string): Promise<AnomalyAssessment | null> {
    const response = await apiClient.get(
      `/anomaly/instruments/${instrumentId}/latest`
    );
    return response.data?.data?.assessment || null;
  },
};
