import mongoose from 'mongoose';
import { PredictiveAssessment, IPredictiveAssessment } from '../models/predictive-assessment.model';
import { Instrument } from '../models/instrument.model';
import { Inspection } from '../models/inspection.model';
import { aiServiceClient } from './ai-client.service';
import { generatePredictiveId } from '../utils/phase7-id.utils';
import { IUser } from '../models/user.model';
import Decimal from 'decimal.js';

export class PredictiveService {
  private calculateLocalPredictiveTrend(history: Array<{ inspectionDate: string; inspectorResult: string; deviationPercentage?: number | null }>) {
    const sampleCount = history.length;
    if (sampleCount < 2) {
      return {
        status: 'INSUFFICIENT_DATA' as const,
        trendDirection: 'INSUFFICIENT_DATA' as const,
        slope: null,
        sampleCount,
        evidence: ['Fewer than 2 finalized inspection records exist for predictive trend analysis.'],
        dataCoverage: Math.round((sampleCount / 5.0) * 100),
        attentionRecommendation: 'Gather more finalized inspection history before executing predictive trend calculations.',
        disclaimer: 'Decision support output only. NEVER call it legal failure prediction or override statutory inspection status.'
      };
    }

    const validDeviations = history
      .map((h) => (h.deviationPercentage !== null && h.deviationPercentage !== undefined ? Math.abs(h.deviationPercentage) : null))
      .filter((d): d is number => d !== null);

    if (validDeviations.length < 2) {
      return {
        status: 'INSUFFICIENT_DATA' as const,
        trendDirection: 'INSUFFICIENT_DATA' as const,
        slope: null,
        sampleCount,
        evidence: ['Fewer than 2 records contain valid numeric deviation percentages.'],
        dataCoverage: Math.round((validDeviations.length / 5.0) * 100),
        attentionRecommendation: 'Ensure reference readings and deviation measurements are recorded during inspections.',
        disclaimer: 'Decision support output only. NEVER call it legal failure prediction or override statutory inspection status.'
      };
    }

    // Simple linear regression slope: y = slope * x + intercept
    const n = validDeviations.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = validDeviations[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumXX - sumX * sumX;
    const slopeRaw = denominator !== 0 ? numerator / denominator : 0;
    const slope = new Decimal(slopeRaw).toDecimalPlaces(4).toNumber();
    const meanDev = new Decimal(sumY).dividedBy(n).toDecimalPlaces(4).toNumber();

    let trendDirection: 'IMPROVING' | 'STABLE' | 'WORSENING' = 'STABLE';
    let attentionRecommendation = 'Maintain standard verification frequency.';

    if (slope > 0.05) {
      trendDirection = 'WORSENING';
      attentionRecommendation = 'Schedule proactive verification ahead of standard interval due to rising absolute deviation.';
    } else if (slope < -0.05) {
      trendDirection = 'IMPROVING';
      attentionRecommendation = 'Maintain routine periodic verification schedule; deviation trend is stable to improving.';
    }

    return {
      status: 'SUCCESS' as const,
      trendDirection,
      slope,
      sampleCount,
      evidence: [
        `Analyzed ${n} chronological deviation records via statistical fallback model.`,
        `Deviation trend slope: ${slope >= 0 ? '+' : ''}${slope}% per inspection cycle.`,
        `Mean absolute deviation: ${meanDev}%.`
      ],
      dataCoverage: Math.min(100, Math.round((n / 5.0) * 100)),
      attentionRecommendation,
      disclaimer: 'Decision support output only. NEVER call it legal failure prediction or override statutory inspection status.'
    };
  }

  async analyzePredictiveTrend(instrumentId: string, caller: IUser): Promise<IPredictiveAssessment> {
    if (!['ADMIN', 'INSPECTOR'].includes(caller.role)) {
      throw Object.assign(new Error('Only ADMIN or INSPECTOR can perform predictive trend analysis'), { statusCode: 403 });
    }

    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const inspections = await Inspection.find({
      instrument: inst._id,
      status: 'FINALIZED'
    })
      .sort({ createdAt: 1 })
      .select('createdAt inspectorResult deviationPercentage');

    const historyPayload = inspections.map((insp) => ({
      inspectionDate: insp.createdAt ? insp.createdAt.toISOString() : new Date().toISOString(),
      inspectorResult: insp.inspectorResult,
      deviationPercentage: insp.deviationPercentage ?? null
    }));

    let analysisResult;
    try {
      const aiRes = await aiServiceClient.analyzePredictive({
        instrumentId: inst.instrumentId,
        history: historyPayload
      });
      analysisResult = {
        status: aiRes.status,
        trendDirection: aiRes.trendDirection,
        slope: aiRes.slope ?? null,
        sampleCount: aiRes.sampleCount,
        evidence: aiRes.evidence,
        dataCoverage: aiRes.dataCoverage * 100,
        attentionRecommendation: aiRes.attentionRecommendation,
        disclaimer: aiRes.disclaimer
      };
    } catch {
      // Graceful fallback to statistical linear trend calculation if FastAPI is unavailable
      analysisResult = this.calculateLocalPredictiveTrend(historyPayload);
    }

    const assessmentId = await generatePredictiveId();
    const assessment = new PredictiveAssessment({
      assessmentId,
      instrument: inst._id,
      instrumentIdSnapshot: inst.instrumentId,
      status: analysisResult.status,
      trendDirection: analysisResult.trendDirection,
      slope: analysisResult.slope,
      sampleCount: analysisResult.sampleCount,
      evidence: analysisResult.evidence,
      dataCoverage: analysisResult.dataCoverage,
      attentionRecommendation: analysisResult.attentionRecommendation,
      disclaimer: analysisResult.disclaimer || 'Decision support output only. NEVER call it legal failure prediction or override statutory inspection status.',
      assessedBy: caller._id,
      assessedAt: new Date()
    });

    await assessment.save();
    return assessment;
  }

  async getLatestPredictive(instrumentId: string, caller: IUser) {
    const inst = await Instrument.findOne({ instrumentId: instrumentId.trim().toUpperCase() });
    if (!inst) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    if (caller.role === 'OWNER' && inst.owner.toString() !== (caller._id as any).toString()) {
      throw Object.assign(new Error('Instrument not found'), { statusCode: 404 });
    }

    const latest = await PredictiveAssessment.findOne({ instrument: inst._id })
      .sort({ assessedAt: -1 })
      .populate('assessedBy', 'name role -_id');

    if (!latest) {
      throw Object.assign(new Error('No predictive assessment found for this instrument'), { statusCode: 404 });
    }
    return latest;
  }
}

export const predictiveService = new PredictiveService();
