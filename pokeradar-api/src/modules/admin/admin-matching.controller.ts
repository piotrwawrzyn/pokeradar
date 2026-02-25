import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { AdminMatchingService } from './admin-matching.service';
import { AppError } from '../../shared/middleware';

const service = new AdminMatchingService();

export class AdminMatchingController {
  async getReviewQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await service.getReviewQueue();
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  async getRejections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, shopId, reason, page, limit } = req.query as Record<string, string>;
      const result = await service.getRejections({
        productId,
        shopId,
        reason,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getCorrections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as Record<string, string>;
      const result = await service.getCorrections({
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = getAuth(req).userId ?? 'unknown';
      const result = await service.confirmMatch(String(req.params.matchId), adminId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async correct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = getAuth(req).userId ?? 'unknown';
      const { correctProductId, reason } = req.body;
      if (!correctProductId || !reason) {
        throw new AppError(400, 'correctProductId and reason are required');
      }
      const result = await service.correctMatch(String(req.params.matchId), adminId, {
        correctProductId,
        reason,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = getAuth(req).userId ?? 'unknown';
      const { reason } = req.body;
      if (!reason || !['NON_ENGLISH', 'FALSE_POSITIVE'].includes(reason)) {
        throw new AppError(400, 'reason must be NON_ENGLISH or FALSE_POSITIVE');
      }
      const result = await service.rejectMatch(String(req.params.matchId), adminId, reason);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
