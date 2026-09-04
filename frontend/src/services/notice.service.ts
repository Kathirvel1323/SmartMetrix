import { apiClient } from './api';
import type { ImprovementNotice, NoticeStatus } from '../types';

export const noticeService = {
  /**
   * GET /api/improvement-notices
   * Returns all improvement notices scoped to role.
   * Response: { status, data: { notices: [...] } }
   */
  async listNotices(): Promise<ImprovementNotice[]> {
    const response = await apiClient.get('/improvement-notices');
    return response.data?.data?.notices || [];
  },

  /**
   * GET /api/improvement-notices/:noticeId
   * Returns a single notice by its _id.
   * Response: { status, data: { notice: {...} } }
   */
  async getNoticeById(noticeId: string): Promise<ImprovementNotice> {
    const response = await apiClient.get(`/improvement-notices/${noticeId}`);
    return response.data?.data?.notice;
  },

  /**
   * PATCH /api/improvement-notices/:noticeId/status
   * Update notice status.
   * Body: { status, remarks?, closureRemarks? }
   * Response: { status, data: { notice: {...} } }
   */
  async updateNoticeStatus(
    noticeId: string,
    status: NoticeStatus,
    remarks?: string,
    closureRemarks?: string
  ): Promise<ImprovementNotice> {
    const response = await apiClient.patch(
      `/improvement-notices/${noticeId}/status`,
      { status, remarks, closureRemarks }
    );
    return response.data?.data?.notice;
  },
};
