import { apiClient } from './api';

export interface SearchParams {
  query?: string;
  entityType?: string;
  status?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  entityType: 'INSTRUMENT' | 'INSPECTION' | 'VERIFICATION' | 'CERTIFICATE' | 'NOTICE' | 'COMPLAINT';
  title: string;
  subtitle: string;
  status?: string;
  date?: string;
  details?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

export const searchService = {
  async search(params: SearchParams): Promise<SearchResponse> {
    const response = await apiClient.get('/search', { params });
    return response.data;
  }
};
