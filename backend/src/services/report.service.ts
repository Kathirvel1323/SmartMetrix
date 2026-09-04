const PDFDocument = require('pdfkit');
import { Instrument } from '../models/instrument.model';
import { VerificationRequest } from '../models/verification-request.model';
import { Inspection } from '../models/inspection.model';
import { RiskAssessment } from '../models/risk-assessment.model';
import { RegionalCorrelationAssessment } from '../models/regional-correlation.model';
import { AnomalyAssessment } from '../models/anomaly-assessment.model';
import { Certificate } from '../models/certificate.model';
import { ImprovementNotice } from '../models/improvement-notice.model';
import { auditService } from './audit.service';

export type ReportType =
  | 'instruments'
  | 'verifications'
  | 'inspections'
  | 'high-risk'
  | 'regional-risk'
  | 'anomalies'
  | 'certificate-expiry'
  | 'improvement-notices';

export class ReportService {
  /**
   * Prevents CSV formula injection by prepending single quote to values starting with =, +, -, @
   */
  private sanitizeCsvCell(value: any): string {
    if (value === null || value === undefined) return '';
    let str = String(value);
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    // Escape double quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private buildCsv(headers: string[], rows: any[][]): string {
    const headerLine = headers.map((h) => this.sanitizeCsvCell(h)).join(',');
    const dataLines = rows.map((r) => r.map((c) => this.sanitizeCsvCell(c)).join(','));
    return [headerLine, ...dataLines].join('\n');
  }

  private async generatePdfBuffer(title: string, headers: string[], rows: any[][]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: any) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(16).text(`SmartMetrix - ${title}`, { align: 'center' });
        doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown(1.5);

        // Simple table representation
        doc.fontSize(9).text(headers.join(' | '));
        doc.moveDown(0.5);
        doc.text('---------------------------------------------------------------------------------------------------');
        doc.moveDown(0.5);

        for (const row of rows) {
          const rowStr = row.map((cell) => String(cell ?? '')).join(' | ');
          doc.text(rowStr.length > 120 ? rowStr.substring(0, 117) + '...' : rowStr);
          doc.moveDown(0.3);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private getScopeFilter(user: { id: string; role: string }, reportType: ReportType): any {
    if (user.role === 'ADMIN') return {};

    if (user.role === 'OWNER') {
      if (['instruments', 'verifications', 'inspections', 'certificate-expiry'].includes(reportType)) {
        return { ownerId: user.id };
      }
      if (reportType === 'improvement-notices') {
        return { issuedToOwnerId: user.id };
      }
      return { _id: null }; // block other reports for owner
    }

    if (user.role === 'INSPECTOR') {
      if (['verifications', 'inspections'].includes(reportType)) {
        return { $or: [{ inspectorId: user.id }, { assignedInspectorId: user.id }] };
      }
      if (reportType === 'improvement-notices') {
        return { issuedByInspectorId: user.id };
      }
      if (['instruments', 'high-risk', 'regional-risk', 'anomalies', 'certificate-expiry'].includes(reportType)) {
        return {}; // Permitted operational view
      }
    }

    return {};
  }

  async generateReport(
    user: { id: string; role: string; email?: string },
    reportType: ReportType,
    format: 'pdf' | 'csv',
    query: { startDate?: string; endDate?: string; city?: string; limit?: number },
    reqInfo?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ buffer: Buffer | string; mimeType: string; filename: string }> {
    const scope = this.getScopeFilter(user, reportType);

    if (scope._id === null) {
      const err: any = new Error('Forbidden: Insufficient privileges for requested report type');
      err.statusCode = 403;
      throw err;
    }

    const maxLimit = format === 'csv' ? 5000 : 500;
    const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || maxLimit));

    let headers: string[] = [];
    let rows: any[][] = [];
    let title = '';

    switch (reportType) {
      case 'instruments': {
        title = 'Instruments Report';
        headers = ['Instrument ID', 'Serial Number', 'Category', 'Manufacturer', 'City', 'Status'];
        const list = await Instrument.find(scope).limit(limit).lean();
        rows = list.map((item) => [
          item.instrumentId,
          item.serialNumber,
          item.category,
          item.manufacturer,
          item.location?.city || '',
          item.status
        ]);
        break;
      }
      case 'verifications': {
        title = 'Verifications Report';
        headers = ['Request ID', 'Instrument ID', 'Type', 'Status', 'Scheduled Date', 'City'];
        const list = await VerificationRequest.find(scope).limit(limit).lean();
        rows = list.map((item: any) => [
          item.requestId,
          item.instrumentIdSnapshot || item.instrumentId || '',
          item.verificationType,
          item.status,
          item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 10) : '',
          item.location?.city || ''
        ]);
        break;
      }
      case 'inspections': {
        title = 'Inspections Report';
        headers = ['Inspection ID', 'Request ID', 'Instrument ID', 'Result', 'Inspection Date'];
        const list = await Inspection.find(scope).limit(limit).lean();
        rows = list.map((item: any) => [
          item.inspectionId,
          item.requestId,
          item.instrumentIdSnapshot || item.instrumentId || '',
          item.inspectorResult || item.overallResult || '',
          new Date(item.inspectionDate).toISOString().slice(0, 10)
        ]);
        break;
      }
      case 'high-risk': {
        title = 'High Risk Assessment Report';
        headers = ['Assessment ID', 'Instrument ID', 'Risk Score', 'Risk Level', 'Date'];
        const filter = { ...scope, riskLevel: { $in: ['HIGH', 'CRITICAL'] } };
        const list = await RiskAssessment.find(filter).limit(limit).lean();
        rows = list.map((item: any) => [
          item.assessmentId,
          item.instrumentIdSnapshot || item.instrumentId || '',
          item.riskScore ?? item.overallRiskScore,
          item.riskLevel,
          new Date(item.assessedAt).toISOString().slice(0, 10)
        ]);
        break;
      }
      case 'regional-risk': {
        title = 'Regional Risk Clusters Report';
        headers = ['Assessment ID', 'Instrument ID', 'Avg Similarity', 'Pattern Type'];
        const list = await RegionalCorrelationAssessment.find(scope).limit(limit).lean();
        rows = list.map((item: any) => [
          item.assessmentId,
          item.instrumentIdSnapshot,
          item.averageSimilarityScore,
          item.patternType
        ]);
        break;
      }
      case 'anomalies': {
        title = 'Anomalies Assessment Report';
        headers = ['Assessment ID', 'Instrument ID', 'Anomaly Score', 'Is Anomaly', 'Source'];
        const filter = { ...scope, potentialAnomaly: true };
        const list = await AnomalyAssessment.find(filter).limit(limit).lean();
        rows = list.map((item: any) => [
          item.assessmentId,
          item.instrumentIdSnapshot || item.instrumentId || '',
          item.anomalyScore,
          item.potentialAnomaly ? 'YES' : 'NO',
          item.method || item.source || ''
        ]);
        break;
      }
      case 'certificate-expiry': {
        title = 'Certificate Expiry Report';
        headers = ['Certificate ID', 'Instrument ID', 'Status', 'Issue Date', 'Expiry Date'];
        const list = await Certificate.find(scope).sort({ expiresAt: 1 }).limit(limit).lean();
        rows = list.map((item: any) => [
          item.certificateNumber || item.certificateId || '',
          item.instrumentSnapshot?.instrumentId || '',
          item.status,
          new Date(item.issuedAt).toISOString().slice(0, 10),
          new Date(item.expiresAt).toISOString().slice(0, 10)
        ]);
        break;
      }
      case 'improvement-notices': {
        title = 'Improvement Notices Report';
        headers = ['Notice ID', 'Instrument ID', 'Status', 'Issued Date', 'Deadline'];
        const list = await ImprovementNotice.find(scope).limit(limit).lean();
        rows = list.map((item: any) => [
          item.noticeId,
          item.instrumentIdSnapshot || item.instrumentId || '',
          item.status,
          new Date(item.issueDate || item.issuedAt).toISOString().slice(0, 10),
          new Date(item.deadline).toISOString().slice(0, 10)
        ]);
        break;
      }
      default: {
        const err: any = new Error(`Unsupported report type: ${reportType}`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Record audit log
    await auditService.logAction({
      actor: { userId: user.id, role: user.role, email: user.email },
      action: 'GENERATE_REPORT',
      entityType: 'Report',
      entityId: `${reportType}-${format}`,
      metadata: { reportType, format, rowCount: rows.length },
      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `smartmetrix_${reportType}_${timestamp}.${format}`;

    if (format === 'csv') {
      const csvStr = this.buildCsv(headers, rows);
      return {
        buffer: Buffer.from(csvStr, 'utf-8'),
        mimeType: 'text/csv',
        filename
      };
    } else {
      const pdfBuf = await this.generatePdfBuffer(title, headers, rows);
      return {
        buffer: pdfBuf,
        mimeType: 'application/pdf',
        filename
      };
    }
  }
}

export const reportService = new ReportService();
