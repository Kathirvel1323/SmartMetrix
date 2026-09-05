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
  owner: string | User;
  type: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity: { value: number; unit: string };
  accuracyClass?: string;
  status: 'REGISTERED' | 'ACTIVE' | 'INACTIVE' | 'UNDER_VERIFICATION' | 'SUSPENDED' | 'DECOMMISSIONED';
  location: {
    address: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    coordinates?: { type: 'Point'; coordinates: [number, number] };
  };
  isArchived: boolean;
  createdAt: string;
}

export interface VerificationRequest {
  _id: string;
  requestId: string;
  instrument: Instrument;
  owner: User;
  assignedInspector?: User;
  verificationType: 'INITIAL' | 'RE_VERIFICATION';
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'SCHEDULED' | 'INSPECTION_COMPLETED' | 'PASSED' | 'FAILED' | 'CERTIFICATE_ISSUED' | 'CLOSED';
  scheduledAt?: string;
  estimatedDurationMinutes?: number;
  createdAt: string;
}

export interface Inspection {
  _id: string;
  inspectionId: string;
  verificationRequest: VerificationRequest;
  instrument: Instrument;
  instrumentIdSnapshot: string;
  inspector: User;
  status: 'PENDING' | 'FINALIZED' | 'FAILED';
  inspectorResult: 'PASS' | 'FAIL';
  calculatedAssessment: 'WITHIN_TOLERANCE' | 'OUTSIDE_TOLERANCE';
  overrideReason?: string;
  referenceReading: number;
  actualReading: number;
  deviation: number;
  deviationPercentage: number | null;
  toleranceSnapshot: { ruleId: string; name: string; toleranceMode: string; toleranceValue: number; capacityUnit: string };
  gps?: { type: 'Point'; coordinates: [number, number]; accuracy?: number; capturedAt?: string };
  evidence?: Array<{ evidenceId: string; originalMime: string; sizeBytes: number; uploadedAt: string; downloadUrl?: string }>;
  submittedAt: string;
  createdAt: string;
}

export interface DashboardKpis {
  totalInstruments: number;
  pendingVerifications: number;
  totalInspections: number;
  activeCertificates: number;
  highRiskCount: number;
  // Legacy/optional fields kept for backwards compatibility
  activeInstruments?: number;
  completedInspections?: number;
  totalCertificates?: number;
  activeNotices?: number;
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

// ── Batch 2 Types ──────────────────────────────────────────────────────────────

export type CertificateStatus = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';

export interface Certificate {
  _id: string;
  certificateNumber: string;
  publicVerificationId: string;
  instrument: Instrument | string;
  owner: User | string;
  instrumentSnapshot: {
    instrumentId: string;
    type: string;
    category: string;
    manufacturer: string;
    model: string;
    maskedSerialNumber: string;
    capacity: { value: number; unit: string };
  };
  verificationSnapshot: {
    requestId: string;
    verificationType: string;
  };
  inspectionSnapshot: {
    inspectionId: string;
    inspectorResult: string;
    calculatedAssessment: string;
    referenceReading: number;
    actualReading: number;
    deviation: number;
    deviationPercentage: number | null;
  };
  verificationDate: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  status: CertificateStatus;
  policySnapshot: {
    policyId: string;
    name: string;
    validityPeriodMonths: number;
    version: number;
  };
  integrityMetadata: {
    payloadHash: string;
    hmacSeal: string;
    algorithm: string;
    label: string;
  };
  createdAt: string;
}

export type NoticeStatus =
  | 'OPEN'
  | 'CORRECTION_IN_PROGRESS'
  | 'REINSPECTION_PENDING'
  | 'CLOSED'
  | 'ESCALATED';

export interface ImprovementNotice {
  _id: string;
  noticeId: string;
  instrument: Instrument | string;
  inspection: Inspection | string;
  issuedBy: User | string;
  reason: string;
  issueDate: string;
  deadline: string;
  requiredCorrection: string;
  status: NoticeStatus;
  reInspectionDate?: string;
  closureRemarks?: string;
  statusHistory: Array<{
    status: NoticeStatus;
    timestamp: string;
    changedBy: string;
    remarks?: string;
  }>;
  createdAt: string;
}

export interface RiskFactor {
  factor: string;
  available: boolean;
  rawValue: number | null;
  normalizedValue: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  contribution: number;
}

export interface RiskPriority {
  _id: string;
  assessmentId: string;
  instrument: {
    _id: string;
    instrumentId: string;
    name?: string;
    manufacturer?: string;
    model?: string;
    type: string;
    location?: { city?: string; district?: string; state?: string };
  };
  instrumentIdSnapshot: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  missingFactors: string[];
  dataCoverage: number;
  recommendedAction: string;
  disclaimer: string;
  trustScore: number;
  trustLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  assessedAt: string;
}

export interface RiskConfiguration {
  _id: string;
  name: string;
  isActive: boolean;
  weights: Record<string, number>;
  thresholds: Record<string, { min: number; max: number }>;
  missingDataStrategy: string;
  version: number;
  createdAt: string;
}

export interface AnomalyAssessment {
  _id: string;
  assessmentId: string;
  instrument: {
    _id: string;
    instrumentId: string;
    name?: string;
    manufacturer?: string;
    model?: string;
    type: string;
    location?: { city?: string; district?: string };
  };
  instrumentIdSnapshot: string;
  method: 'ISOLATION_FOREST' | 'DETERMINISTIC_STATISTICAL_FALLBACK' | 'INSUFFICIENT_DATA';
  status: 'POTENTIAL_ANOMALY' | 'NORMAL' | 'INSUFFICIENT_DATA';
  potentialAnomaly: boolean;
  anomalyScore: number | null;
  confidence: number | null;
  features: Array<{
    name: string;
    value: number | null;
    available: boolean;
    explanation: string;
  }>;
  dataCoverage: number;
  contributingFactors: string[];
  modelMetadata: {
    algorithm: string;
    version: string;
    sampleCount: number;
    featuresUsed: string[];
  };
  disclaimer: string;
  assessedAt: string;
}
