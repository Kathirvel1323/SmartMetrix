import { apiClient } from './api';

export interface PhotoAssistQualityMetrics {
  blurScore: number;
  brightnessScore: number;
  contrastScore: number;
  resolutionWidth: number;
  resolutionHeight: number;
}

export interface PhotoAssistAssessment {
  _id?: string;
  assessmentId: string;
  instrumentIdSnapshot: string;
  qualityMetrics: PhotoAssistQualityMetrics;
  semanticFields: {
    serialNumberText: 'NOT_ASSESSED' | string;
    sealText: 'NOT_ASSESSED' | string;
    readoutText: 'NOT_ASSESSED' | string;
  };
  irregularities: string[];
  disclaimer: string;
  assessedAt: string;
}

export interface PredictiveAssessment {
  _id?: string;
  assessmentId: string;
  instrumentIdSnapshot: string;
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA';
  slope: number | null;
  sampleCount: number;
  evidence: string[];
  dataCoverage: number;
  attentionRecommendation: string;
  disclaimer: string;
  assessedAt: string;
}

export interface PlanningTwinRepresentation {
  instrumentId: string;
  type: string;
  category: string;
  capacity?: { value: number; unit: string };
  coordinates?: [number, number];
  inspectionHistorySummary: {
    totalFinalized: number;
    passCount: number;
    failCount: number;
    meanAbsDeviationPct: number | null;
  };
  configuredMethod?: string;
  requiredEquipment?: string[];
  estimatedEffortHours?: number;
  missingDataIndicators: string[];
  disclaimer: string;
}

export interface VerificationBurdenPlan {
  planId: string;
  rank: number;
  verificationMethod: string;
  facilityId: string;
  facilityName: string;
  facilityLocation: {
    city: string;
    state: string;
    distanceKm: number;
  };
  requiredEquipment: string[];
  equipmentAvailable: boolean;
  missingEquipment: string[];
  estimatedEffortHours: number;
  burdenScore: number;
  reasons: string[];
  disclaimer: string;
}

export interface BurdenOptimizeResponse {
  status: string;
  message?: string;
  instrumentId?: string;
  recommendedPlans?: VerificationBurdenPlan[];
  disclaimer: string;
}

export interface GeoScheduleRecommendationItem {
  rank: number;
  inspectorId: string;
  name: string;
  distanceKm: number;
  activeSchedulesCount: number;
  score: number;
  reason: string;
}

export interface GeoScheduleResponse {
  status: string;
  instrumentId: string;
  recommendations: GeoScheduleRecommendationItem[];
  disclaimer: string;
}

export interface VerificationMethodRule {
  _id: string;
  ruleId: string;
  name: string;
  instrumentType: string;
  instrumentCategory: string;
  verificationMethod: string;
  requiredEquipment: string[];
  estimatedEffortHours: number;
  isActive: boolean;
  createdAt: string;
}

export const phase7Service = {
  // 1. Photo Assist
  async analyzePhoto(formData: FormData): Promise<PhotoAssistAssessment> {
    const response = await apiClient.post('/phase7/photo-assist/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data?.assessment || response.data;
  },

  async getLatestPhotoAssist(instrumentId: string): Promise<PhotoAssistAssessment | null> {
    const response = await apiClient.get(`/phase7/photo-assist/instruments/${instrumentId}/latest`);
    return response.data?.assessment || response.data;
  },

  // 2. Predictive Trend Analysis
  async analyzePredictive(instrumentId: string): Promise<PredictiveAssessment> {
    const response = await apiClient.post(`/phase7/predictive/instruments/${instrumentId}/analyze`, {});
    return response.data?.assessment || response.data;
  },

  async getLatestPredictive(instrumentId: string): Promise<PredictiveAssessment | null> {
    const response = await apiClient.get(`/phase7/predictive/instruments/${instrumentId}/latest`);
    return response.data?.assessment || response.data;
  },

  // 3. Planning Twin & Burden Optimization
  async getPlanningTwin(instrumentId: string): Promise<PlanningTwinRepresentation> {
    const response = await apiClient.get(`/phase7/planning/twin/${instrumentId}`);
    return response.data?.twin || response.data;
  },

  async optimizeBurden(instrumentId: string): Promise<BurdenOptimizeResponse> {
    const response = await apiClient.post('/phase7/planning/burden-optimize', { instrumentId });
    return response.data;
  },

  // 4. Geo-Scheduling
  async recommendGeoSchedule(instrumentId: string): Promise<GeoScheduleResponse> {
    const response = await apiClient.post('/phase7/planning/geo-schedule-recommend', { instrumentId });
    return response.data;
  },

  // 5. Verification Method Rules Management (ADMIN)
  async listVerificationRules(): Promise<VerificationMethodRule[]> {
    const response = await apiClient.get('/phase7/admin/verification-rules');
    return response.data?.rules || response.data || [];
  },

  async createVerificationRule(payload: {
    name: string;
    instrumentType: string;
    instrumentCategory: string;
    verificationMethod: string;
    requiredEquipment: string[];
    estimatedEffortHours?: number;
  }): Promise<VerificationMethodRule> {
    const response = await apiClient.post('/phase7/admin/verification-rules', payload);
    return response.data?.rule || response.data;
  },

  async deactivateVerificationRule(ruleId: string): Promise<VerificationMethodRule> {
    const response = await apiClient.post(`/phase7/admin/verification-rules/${ruleId}/deactivate`, {});
    return response.data?.rule || response.data;
  }
};
