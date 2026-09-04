import { apiClient } from './api';

export const regionalService = {
  /**
   * GET /api/regional/map
   * Returns GeoJSON FeatureCollection of all instrument positions (ADMIN, INSPECTOR, OWNER).
   * Note: The controller returns the geojson directly (no { status, data } wrapper).
   */
  async getMapData(): Promise<GeoJSON.FeatureCollection | null> {
    const response = await apiClient.get('/regional/map');
    return response.data || null;
  },

  /**
   * GET /api/regional/clusters
   * Returns identified Potential Clusters from regional correlation data (ADMIN, INSPECTOR).
   * Response: { status, data: { clusters: [...] } }
   */
  async getClusters(): Promise<any[]> {
    const response = await apiClient.get('/regional/clusters');
    return response.data?.data?.clusters || [];
  },

  /**
   * GET /api/regional/configs/active
   * Returns the active regional configuration (ADMIN, INSPECTOR).
   * Response: { status, data: { config: {...} } }
   */
  async getActiveConfig(): Promise<any | null> {
    const response = await apiClient.get('/regional/configs/active');
    return response.data?.data?.config || null;
  },
};
