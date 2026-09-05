import { apiClient } from './api';

export interface ComplaintItem {
  _id: string;
  complaintId: string;
  trackingToken: string;
  publicVerificationId: string;
  instrument?: string;
  category: string;
  description: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  resolutionSummary?: string;
  submittedAt: string;
  decryptedContact?: string;
  createdAt: string;
  updatedAt: string;
}

export const complaintService = {
  async listComplaints(): Promise<ComplaintItem[]> {
    const response = await apiClient.get('/complaints');
    return response.data?.data?.complaints || [];
  },

  async getComplaintDetails(complaintId: string): Promise<ComplaintItem> {
    const response = await apiClient.get(`/complaints/${complaintId}`);
    return response.data?.data?.complaint;
  },

  async updateComplaintStatus(
    complaintId: string,
    payload: { status: string; remarks?: string; resolutionSummary?: string }
  ): Promise<ComplaintItem> {
    const response = await apiClient.patch(`/complaints/${complaintId}/status`, payload);
    return response.data?.data?.complaint;
  }
};
