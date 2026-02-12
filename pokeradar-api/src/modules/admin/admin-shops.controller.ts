import { Request, Response, NextFunction } from 'express';
import { AdminShopsService } from './admin-shops.service';
import { NotFoundError } from '../../shared/middleware';

const shopsService = new AdminShopsService();

export class AdminShopsController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shops = await shopsService.listShops();
      res.json(shops);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await shopsService.getShopDetail(req.params.shopId as string);
      if (!detail) throw new NotFoundError('Shop not found');
      res.json(detail);
    } catch (error) {
      next(error);
    }
  }
}
