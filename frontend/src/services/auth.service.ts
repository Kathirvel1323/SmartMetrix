import { apiClient } from './api';
import type { AuthResponse, User } from '../types';

export const authService = {
  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    const response = await apiClient.post<{ status: string; message: string; data: AuthResponse }>('/auth/login', credentials);
    const authData = response.data?.data || (response.data as any);
    if (authData?.token) {
      localStorage.setItem('smartmetrix_token', authData.token);
      localStorage.setItem('smartmetrix_user', JSON.stringify(authData.user));
    }
    return authData;
  },

  async register(data: { name: string; email: string; password: string; phone?: string; organization?: string }): Promise<AuthResponse> {
    const response = await apiClient.post<{ status: string; message: string; data: AuthResponse }>('/auth/register', data);
    const authData = response.data?.data || (response.data as any);
    if (authData?.token) {
      localStorage.setItem('smartmetrix_token', authData.token);
      localStorage.setItem('smartmetrix_user', JSON.stringify(authData.user));
    }
    return authData;
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get<{ status: string; data: { user: User } }>('/auth/me');
    return response.data?.data?.user || (response.data as any).user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('smartmetrix_token');
      localStorage.removeItem('smartmetrix_user');
    }
  },

  getStoredUser(): User | null {
    const stored = localStorage.getItem('smartmetrix_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as User;
    } catch {
      return null;
    }
  },

  getStoredToken(): string | null {
    return localStorage.getItem('smartmetrix_token');
  }
};
