import { Request, Response, NextFunction } from 'express';
import { improvementNoticeService } from '../services/improvement-notice.service';

export class ImprovementNoticeController {
  async issueNotice(req: Request, res: Response, next: NextFunction) {
    try {
      const notice = await improvementNoticeService.issueNotice(req.body, req.user!);
      return res.status(201).json({ status: 'success', data: { notice } });
    } catch (err) {
      next(err);
    }
  }

  async listNotices(req: Request, res: Response, next: NextFunction) {
    try {
      const notices = await improvementNoticeService.listNotices(req.user!);
      return res.status(200).json({ status: 'success', data: { notices } });
    } catch (err) {
      next(err);
    }
  }

  async getNoticeById(req: Request, res: Response, next: NextFunction) {
    try {
      const noticeId = Array.isArray(req.params.noticeId) ? req.params.noticeId[0] : req.params.noticeId;
      const notice = await improvementNoticeService.getNoticeById(noticeId, req.user!);
      return res.status(200).json({ status: 'success', data: { notice } });
    } catch (err) {
      next(err);
    }
  }

  async updateNoticeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const noticeId = Array.isArray(req.params.noticeId) ? req.params.noticeId[0] : req.params.noticeId;
      const { status, remarks, closureRemarks } = req.body;
      const notice = await improvementNoticeService.updateNoticeStatus(
        noticeId,
        status,
        remarks,
        closureRemarks,
        req.user!
      );
      return res.status(200).json({ status: 'success', data: { notice } });
    } catch (err) {
      next(err);
    }
  }
}

export const improvementNoticeController = new ImprovementNoticeController();
