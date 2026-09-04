export type UserRole = 'ADMIN' | 'INSPECTOR' | 'OWNER';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  organization?: string;
  district?: string;
  state?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Instrument {
  _id: string;
  instrumentId: string;
  ownerId: string | User;
  name: string;
  type: string;
  category: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  capacityValue: number;
  capacityUnit: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  lastVerificationDate?: string;
  nextVerificationDueDate?: string;
  location: {
    address: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    coordinates?: [number, number];
  };
  isActive: boolean;
  createdAt: string;
}

export interface VerificationRequest {
  _id: string;
  requestId: string;
  instrumentId: Instrument;
  ownerId: User;
  assignedInspectorId?: User;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'SCHEDULED' | 'PASSED' | 'REJECTED' | 'CANCELLED';
  scheduledAt?: string;
  estimatedDurationMinutes?: number;
  createdAt: string;
}

export interface Inspection {
  _id: string;
  inspectionId: string;
  verificationRequestId: VerificationRequest;
  instrumentId: Instrument;
  inspectorId: User;
  status: 'PENDING' | 'FINALIZED' | 'CANCELLED';
  result: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  calculatedAssessment?: 'PASS' | 'FAIL';
  overrideReason?: string;
  referenceReading: number;
  observedReading: number;
  deviationValue: number;
  deviationUnit: string;
  gpsLocation: {
    latitude: number;
    longitude: number;
  };
  evidencePhotos?: string[];
  createdAt: string;
}

export interface DashboardKpis {
  totalInstruments: number;
  activeInstruments: number;
  pendingVerifications: number;
  completedInspections: number;
  totalCertificates: number;
  activeNotices: number;
  riskDistribution?: Array<{ bandName: string; count: number; color?: string }>;
  passRatePercentage?: number;
}

export interface NotificationItem {
  _id: string;
  notificationId: string;
  recipient: string;
  title: string;
  message: string;
  type: 'EXPIRY_WARNING' | 'HIGH_RISK_ALERT' | 'SYSTEM_NOTICE' | 'INSPECTION_SCHEDULED';
  isRead: boolean;
  createdAt: string;
}
