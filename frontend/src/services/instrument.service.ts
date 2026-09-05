import { apiClient } from './api';
import type { Instrument } from '../types';

export const instrumentService = {
  async getInstruments(params?: { search?: string; type?: string; status?: string; page?: number; limit?: number }): Promise<{ instruments: Instrument[]; total: number; page: number; totalPages: number }> {
    const response = await apiClient.get('/instruments', { params });
    const resBody = response.data;
    const items = resBody.data || resBody.instruments || (Array.isArray(resBody) ? resBody : []);
    const pagination = resBody.pagination || {};
    return {
      instruments: items,
      total: pagination.total || items.length,
      page: pagination.page || 1,
      totalPages: pagination.totalPages || 1,
    };
  },

  async getInstrumentById(id: string): Promise<Instrument> {
    const response = await apiClient.get(`/instruments/${id}`);
    return response.data?.data?.instrument || response.data?.instrument || response.data;
  },

  async registerInstrument(data: Partial<Instrument>): Promise<Instrument> {
    const response = await apiClient.post('/instruments', data);
    return response.data?.data?.instrument || response.data?.instrument || response.data;
  },

  async getInstrumentPassport(id: string): Promise<any> {
    const response = await apiClient.get(`/instruments/${id}/passport`);
    return response.data?.data?.passport || response.data?.passport || response.data;
  }
};
