import mongoose from 'mongoose';
import { Instrument } from '../models/instrument.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Inspection } from '../models/inspection.model';
import { Certificate } from '../models/certificate.model';
import { RiskAssessment } from '../models/risk-assessment.model';
import { AnomalyAssessment } from '../models/anomaly-assessment.model';
import { RegionalCorrelationAssessment } from '../models/regional-correlation.model';
import { ImprovementNotice } from '../models/improvement-notice.model';
import { Complaint } from '../models/complaint.model';

export class AnalyticsService {
  private async getAccessibleInstrumentIds(user: { id: string; role: string }): Promise<mongoose.Types.ObjectId[]> {
    const userOid = new mongoose.Types.ObjectId(user.id);
    if (user.role === 'ADMIN') {
      return Instrument.distinct('_id', {});
    }
    if (user.role === 'OWNER') {
      return Instrument.distinct('_id', { owner: userOid });
    }
    if (user.role === 'INSPECTOR') {
      const [verInsts, inspInsts] = await Promise.all([
        VerificationRequest.distinct('instrument', { assignedInspector: userOid }),
        Inspection.distinct('instrument', { inspector: userOid })
      ]);
      const combined = [...verInsts, ...inspInsts].map((id: any) => id.toString());
      const unique = Array.from(new Set(combined));
      return unique.map((id) => new mongoose.Types.ObjectId(id));
    }
    return [];
  }

  async getDashboardKpis(user: { id: string; role: string }, query: { startDate?: string; endDate?: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const accessibleInstIds = await this.getAccessibleInstrumentIds(user);

    let totalInstruments = 0;
    let pendingVerifications = 0;
    let totalInspections = 0;
    let activeCertificates = 0;
    let highRiskCount = 0;

    if (user.role === 'ADMIN') {
      [totalInstruments, pendingVerifications, totalInspections, activeCertificates, highRiskCount] = await Promise.all([
        Instrument.countDocuments({}),
        VerificationRequest.countDocuments({ status: { $in: ['SUBMITTED', 'PENDING_PAYMENT', 'PAYMENT_VERIFIED', 'ASSIGNED', 'SCHEDULED'] } }),
        Inspection.countDocuments({}),
        Certificate.countDocuments({ status: 'VALID' }),
        RiskAssessment.countDocuments({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } })
      ]);
    } else if (user.role === 'OWNER') {
      [totalInstruments, pendingVerifications, totalInspections, activeCertificates] = await Promise.all([
        Instrument.countDocuments({ owner: userOid }),
        VerificationRequest.countDocuments({ owner: userOid, status: { $in: ['SUBMITTED', 'PENDING_PAYMENT', 'PAYMENT_VERIFIED', 'ASSIGNED', 'SCHEDULED'] } }),
        Inspection.countDocuments({ instrument: { $in: accessibleInstIds } }),
        Certificate.countDocuments({ owner: userOid, status: 'VALID' })
      ]);
      highRiskCount = 0;
    } else if (user.role === 'INSPECTOR') {
      [totalInstruments, pendingVerifications, totalInspections, activeCertificates, highRiskCount] = await Promise.all([
        Instrument.countDocuments({ _id: { $in: accessibleInstIds } }),
        VerificationRequest.countDocuments({ assignedInspector: userOid, status: { $in: ['SUBMITTED', 'PENDING_PAYMENT', 'PAYMENT_VERIFIED', 'ASSIGNED', 'SCHEDULED'] } }),
        Inspection.countDocuments({ inspector: userOid }),
        Certificate.countDocuments({ instrument: { $in: accessibleInstIds }, status: 'VALID' }),
        RiskAssessment.countDocuments({ instrument: { $in: accessibleInstIds }, riskLevel: { $in: ['HIGH', 'CRITICAL'] } })
      ]);
    }

    return {
      kpis: {
        totalInstruments,
        pendingVerifications,
        totalInspections,
        activeCertificates,
        highRiskCount
      }
    };
  }

  async getVerificationDistribution(user: { id: string; role: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const scope: any = {};
    if (user.role === 'OWNER') scope.owner = userOid;
    else if (user.role === 'INSPECTOR') scope.assignedInspector = userOid;

    const distribution = await VerificationRequest.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    return { distribution };
  }

  async getRiskDistribution(user: { id: string; role: string }) {
    if (user.role === 'OWNER') return { distribution: [] };
    const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
    const scope: any = user.role === 'ADMIN' ? {} : { instrument: { $in: accessibleInstIds } };

    const distribution = await RiskAssessment.aggregate([
      { $match: scope },
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
      { $project: { riskLevel: '$_id', count: 1, _id: 0 } }
    ]);
    return { distribution };
  }

  async getPassFailTrends(user: { id: string; role: string }, query: { startDate?: string; endDate?: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const scope: any = {};
    if (user.role === 'OWNER') {
      const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
      scope.instrument = { $in: accessibleInstIds };
    } else if (user.role === 'INSPECTOR') {
      scope.inspector = userOid;
    }

    if (query.startDate || query.endDate) {
      scope.inspectionDate = {};
      if (query.startDate) scope.inspectionDate.$gte = new Date(query.startDate);
      if (query.endDate) scope.inspectionDate.$lte = new Date(query.endDate);
    }

    const trends = await Inspection.aggregate([
      { $match: scope },
      {
        $group: {
          _id: {
            year: { $year: '$inspectionDate' },
            month: { $month: '$inspectionDate' },
            result: '$inspectorResult'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    return { trends };
  }

  async getCertificateValidity(user: { id: string; role: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const scope: any = {};
    if (user.role === 'OWNER') {
      scope.owner = userOid;
    } else if (user.role === 'INSPECTOR') {
      const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
      scope.instrument = { $in: accessibleInstIds };
    }

    const distribution = await Certificate.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    return { distribution };
  }

  async getCityDistribution(user: { id: string; role: string }) {
    const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
    const scope: any = user.role === 'ADMIN' ? {} : { _id: { $in: accessibleInstIds } };

    const distribution = await Instrument.aggregate([
      { $match: scope },
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $project: { city: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);
    return { distribution };
  }

  async getImprovementNoticeStatus(user: { id: string; role: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const scope: any = {};
    if (user.role === 'OWNER') {
      const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
      scope.instrument = { $in: accessibleInstIds };
    } else if (user.role === 'INSPECTOR') {
      scope.issuedBy = userOid;
    }

    const distribution = await ImprovementNotice.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    return { distribution };
  }

  async getComplaintStatus(user: { id: string; role: string }) {
    if (user.role === 'OWNER') return { distribution: [] };
    const userOid = new mongoose.Types.ObjectId(user.id);
    const scope: any = {};
    if (user.role === 'INSPECTOR') {
      const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
      scope.instrument = { $in: accessibleInstIds };
    }

    const distribution = await Complaint.aggregate([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    return { distribution };
  }

  async getAnomalyAndClusterCounts(user: { id: string; role: string }) {
    if (user.role === 'OWNER') return { anomalyCount: 0, clusterCount: 0 };
    const accessibleInstIds = await this.getAccessibleInstrumentIds(user);
    const scope: any = user.role === 'ADMIN' ? {} : { instrument: { $in: accessibleInstIds } };

    const [anomalyCount, clusterCount] = await Promise.all([
      AnomalyAssessment.countDocuments({ ...scope, potentialAnomaly: true }),
      RegionalCorrelationAssessment.countDocuments({ ...scope, patternType: 'Potential Cluster' })
    ]);
    return { anomalyCount, clusterCount };
  }

  async getPriorityInspections(user: { id: string; role: string }) {
    const userOid = new mongoose.Types.ObjectId(user.id);
    const verScope: any = {};
    if (user.role === 'OWNER') verScope.owner = userOid;
    else if (user.role === 'INSPECTOR') verScope.assignedInspector = userOid;

    verScope.status = { $in: ['ASSIGNED', 'SCHEDULED'] };

    const list = await VerificationRequest.find(verScope)
      .populate('instrument', 'instrumentId manufacturer model')
      .sort({ scheduledAt: 1, createdAt: 1 })
      .limit(10)
      .lean();

    return { priorityInspections: list };
  }
}

export const analyticsService = new AnalyticsService();
