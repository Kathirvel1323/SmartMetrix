import { apiClient } from './api';
import type { NotificationItem } from '../types';

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await apiClient.get('/notifications');
    return Array.isArray(response.data) ? response.data : (response.data?.notifications || []);
  },

  async markAsRead(id: string): Promise<NotificationItem> {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data?.notification || response.data;
  },

  async scanNotifications(): Promise<any> {
    const response = await apiClient.post('/notifications/scan', {});
    return response.data;
  },

  async broadcastNotification(payload: { title: string; message: string; targetRole?: string }): Promise<any> {
    const response = await apiClient.post('/notifications/broadcast', payload);
    return response.data;
  }
};
