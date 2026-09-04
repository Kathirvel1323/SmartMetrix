import { Request, Response, NextFunction } from 'express';
import { reportService, ReportType } from '../services/report.service';

export class ReportController {
  async generateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const reportType = (Array.isArray(req.params.reportType) ? req.params.reportType[0] : req.params.reportType) as ReportType;
      const format = (req.query.format === 'pdf' ? 'pdf' : 'csv') as 'pdf' | 'csv';

      const result = await reportService.generateReport(
        user,
        reportType,
        format,
        req.query as any,
        { ipAddress: req.ip, userAgent: req.get('user-agent') }
      );

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.buffer);
    } catch (err) {
      next(err);
    }
  }
}

export const reportController = new ReportController();
