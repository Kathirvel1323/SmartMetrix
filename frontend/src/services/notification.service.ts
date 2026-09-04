import { apiClient } from './api';
import type { NotificationItem } from '../types';

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await apiClient.get<NotificationItem[]>('/notifications');
    return Array.isArray(response.data) ? response.data : ((response.data as any).notifications || []);
  },

  async markAsRead(id: string): Promise<NotificationItem> {
    const response = await apiClient.patch<{ notification: NotificationItem }>(`/notifications/${id}/read`);
    return response.data.notification || (response.data as any);
  }
};
