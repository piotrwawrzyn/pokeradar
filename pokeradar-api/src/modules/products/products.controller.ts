import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service';

const productsService = new ProductsService();

export class ProductsController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await productsService.listAll();
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const product = await productsService.getById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  async getPrices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const product = await productsService.getById(id);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const prices = await productsService.getPrices(id);
      res.json(prices);
    } catch (error) {
      next(error);
    }
  }
}
