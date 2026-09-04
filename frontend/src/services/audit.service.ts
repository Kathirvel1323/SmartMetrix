import { apiClient } from './api';

export interface AuditParams {
  entityType?: string;
  action?: string;
  resultStatus?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogItem {
  _id: string;
  auditId: string;
  timestamp: string;
  actorUserId?: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  resultStatus: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditResponse {
  logs: AuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const auditService = {
  async getAuditLogs(params: AuditParams): Promise<AuditResponse> {
    const response = await apiClient.get('/audit', { params });
    const body = response.data;
    return {
      logs: body?.data || body?.logs || [],
      pagination: body?.pagination || { total: 0, page: 1, limit: 20, pages: 1 }
    };
  }
};
