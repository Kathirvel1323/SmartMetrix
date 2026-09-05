export interface PublicVerificationData {
  certificateNumber: string;
  publicVerificationId: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';
  instrument: {
    instrumentId: string;
    type: string;
    category: string;
    manufacturer: string;
    model: string;
    maskedSerialNumber: string;
  };
  verificationDate: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  integrityStatus: 'VALID' | 'COMPROMISED';
  issuingAuthorityLabel: string;
  disclaimer: string;
}

export interface PublicComplaintPayload {
  publicVerificationId: string;
  category: string;
  description: string;
  complainantContact?: string;
}

export interface PublicComplaintResult {
  complaintId: string;
  trackingToken: string;
  status: string;
  message: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const publicService = {
  async verifyPublicCertificate(
    publicVerificationId: string
  ): Promise<PublicVerificationData> {
    const res = await fetch(`${API_BASE}/public/verify/${publicVerificationId}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.message || 'Verification record not found');
    }
    return body.data;
  },

  getQrImageUrl(publicVerificationId: string): string {
    return `${API_BASE}/public/verify/${publicVerificationId}/qr`;
  },

  async submitPublicComplaint(
    payload: PublicComplaintPayload
  ): Promise<PublicComplaintResult> {
    const res = await fetch(`${API_BASE}/public/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.message || 'Complaint submission failed');
    }
    return body.data;
  },

  async trackComplaint(trackingToken: string): Promise<any> {
    const res = await fetch(
      `${API_BASE}/public/complaints/track/${trackingToken}`
    );
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.message || 'Tracking record not found');
    }
    return body.data;
  },
};
