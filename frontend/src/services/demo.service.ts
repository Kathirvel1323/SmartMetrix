import { apiClient } from './api';

export const demoService = {
  async generateDemoData(count = 100): Promise<any> {
    const response = await apiClient.post('/demo/generate', { count });
    return response.data;
  }
};
