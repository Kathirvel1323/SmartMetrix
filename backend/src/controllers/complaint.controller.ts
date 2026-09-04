import { Request, Response, NextFunction } from 'express';
import { complaintService } from '../services/complaint.service';

export class ComplaintController {
  async listComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const complaints = await complaintService.listComplaints(req.user!);
      return res.status(200).json({ status: 'success', data: { complaints } });
    } catch (err) {
      next(err);
    }
  }

  async getComplaintDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const complaintId = Array.isArray(req.params.complaintId) ? req.params.complaintId[0] : req.params.complaintId;
      const complaint = await complaintService.getComplaintDetails(complaintId, req.user!);
      return res.status(200).json({ status: 'success', data: { complaint } });
    } catch (err) {
      next(err);
    }
  }

  async updateComplaintStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const complaintId = Array.isArray(req.params.complaintId) ? req.params.complaintId[0] : req.params.complaintId;
      const { status, remarks, resolutionSummary } = req.body;
      const complaint = await complaintService.updateComplaintStatus(complaintId, status, remarks, resolutionSummary, req.user!);
      return res.status(200).json({ status: 'success', data: { complaint } });
    } catch (err) {
      next(err);
    }
  }
}

export const complaintController = new ComplaintController();
