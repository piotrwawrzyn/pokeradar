import { Request, Response, NextFunction } from 'express';
import { ProductSetsService } from './product-sets.service';

const productSetsService = new ProductSetsService();

export class ProductSetsController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sets = await productSetsService.listAll();
      res.json(sets);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const set = await productSetsService.getById(id);
      if (!set) {
        res.status(404).json({ error: 'Product set not found' });
        return;
      }
      res.json(set);
    } catch (error) {
      next(error);
    }
  }
}
