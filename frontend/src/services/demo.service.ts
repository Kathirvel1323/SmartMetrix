import { apiClient } from './api';

export interface DemoGenerateOptions {
  count?: number;
  seed?: string;
  idempotencyKey?: string;
}

export const demoService = {
  async generateDemoData(options?: DemoGenerateOptions): Promise<any> {
    const response = await apiClient.post('/demo/generate', options || { count: 100 });
    return response.data;
  }
};
