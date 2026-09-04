import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/search.service';

export class SearchController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const result = await searchService.search(user, {
        query: req.query.query as string,
        entityType: req.query.entityType as string,
        status: req.query.status as string,
        city: req.query.city as string,
        page: Number(req.query.page),
        limit: Number(req.query.limit)
      });

      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

export const searchController = new SearchController();
