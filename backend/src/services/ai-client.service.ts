/**
 * Modular AI Service HTTP Client for SmartMetrix
 * Calls FastAPI Isolation Forest, Photo Assist, and Predictive Analytics service with timeout, token auth, and structured error handling.
 */

export interface FeatureRecordPayload {
  recordId: string;
  features: Record<string, number | null>;
}

export interface AnomalyDetectionRequestPayload {
  records: FeatureRecordPayload[];
  targetRecordId?: string;
  minSamples?: number;
  contamination?: number;
}

export interface AnomalyResultItemPayload {
  recordId: string;
  potentialAnomaly: boolean;
  anomalyScore: number;
  rawScore: number;
  status: 'POTENTIAL_ANOMALY' | 'NORMAL';
  contributingFeatures: string[];
  features: Record<string, number | null>;
}

export interface AnomalyDetectionResponsePayload {
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  method: 'ISOLATION_FOREST' | 'INSUFFICIENT_DATA';
  message: string;
  results: AnomalyResultItemPayload[];
  modelMetadata: {
    algorithm: string;
    version: string;
    sampleCount: number;
    contamination?: number;
    randomState?: number;
    featuresUsed: string[];
  };
  dataCoverage: number;
  disclaimer: string;
}

export interface PhotoAssistResponsePayload {
  status: 'SUCCESS' | 'REJECTED_NON_IMAGE';
  qualityMetrics: {
    resolution: { width: number; height: number };
    brightnessScore: number;
    contrastScore: number;
    sharpnessScore: number;
    overallQualityScore: number;
  };
  semanticFields: {
    seal_intact: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    model_plate_legible: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    serial_number_match: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
    tampering_detected: 'NOT_ASSESSED' | 'MANUAL_REVIEW_REQUIRED';
  };
  irregularities: string[];
  disclaimer: string;
}

export interface PredictiveAnalysisRequestPayload {
  instrumentId: string;
  history: Array<{
    inspectionDate: string;
    inspectorResult: string;
    deviationPercentage?: number | null;
  }>;
}

export interface PredictiveAnalysisResponsePayload {
  status: 'SUCCESS' | 'INSUFFICIENT_DATA';
  trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA';
  slope?: number | null;
  sampleCount: number;
  evidence: string[];
  dataCoverage: number;
  attentionRecommendation: string;
  disclaimer: string;
}

export class AiServiceClient {
  private get baseUrl(): string {
    return (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
  }

  private get serviceToken(): string {
    return process.env.AI_SERVICE_TOKEN || 'smartmetrix_internal_ai_secret_token_2026';
  }

  private get timeoutMs(): number {
    return Number(process.env.AI_SERVICE_TIMEOUT_MS) || 5000;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), Math.min(2000, this.timeoutMs));
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(id);
      return res.ok;
    } catch {
      return false;
    }
  }

  async detectAnomaly(
    payload: AnomalyDetectionRequestPayload
  ): Promise<AnomalyDetectionResponsePayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/detect-anomaly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`AI Service returned HTTP ${res.status}: ${errorText}`);
      }

      return (await res.json()) as AnomalyDetectionResponsePayload;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`AI Service request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  async analyzePhoto(imageBuffer: Buffer, filename = 'photo.jpg'): Promise<PhotoAssistResponsePayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      formData.append('file', blob, filename);

      const res = await fetch(`${this.baseUrl}/photo-assist`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceToken}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err = new Error(`AI Service returned HTTP ${res.status}: ${errorText}`);
        (err as any).statusCode = res.status;
        throw err;
      }

      return (await res.json()) as PhotoAssistResponsePayload;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`AI Service photo assist request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  async analyzePredictive(payload: PredictiveAnalysisRequestPayload): Promise<PredictiveAnalysisResponsePayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/predictive-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serviceToken}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`AI Service returned HTTP ${res.status}: ${errorText}`);
      }

      return (await res.json()) as PredictiveAnalysisResponsePayload;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`AI Service predictive analysis request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }
}

export const aiServiceClient = new AiServiceClient();
