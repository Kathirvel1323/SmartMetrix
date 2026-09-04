import { apiClient } from './api';

export interface ComplaintItem {
  _id: string;
  complaintId: string;
  trackingToken: string;
  instrumentId?: string;
  businessName?: string;
  city: string;
  state: string;
  category: string;
  description: string;
  status: 'RECEIVED' | 'UNDER_INVESTIGATION' | 'RESOLVED' | 'REJECTED';
  remarks?: string;
  resolutionSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export const complaintService = {
  async listComplaints(): Promise<ComplaintItem[]> {
    const response = await apiClient.get('/complaints');
    return response.data?.complaints || [];
  },

  async getComplaintDetails(complaintId: string): Promise<ComplaintItem> {
    const response = await apiClient.get(`/complaints/${complaintId}`);
    return response.data?.complaint;
  },

  async updateComplaintStatus(
    complaintId: string,
    payload: { status: string; remarks?: string; resolutionSummary?: string }
  ): Promise<ComplaintItem> {
    const response = await apiClient.patch(`/complaints/${complaintId}/status`, payload);
    return response.data?.complaint;
  }
};
