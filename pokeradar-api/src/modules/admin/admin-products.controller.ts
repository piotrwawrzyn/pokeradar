import { Request, Response, NextFunction } from 'express';
import { AdminProductsService } from './admin-products.service';
import { AppError } from '../../shared/middleware';

const productsService = new AdminProductsService();

export class AdminProductsController {
  // -- WatchlistProducts --

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await productsService.listProducts();
      res.json(products);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productsService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productsService.updateProduct(req.params.id as string, req.body);
      res.json(product);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productsService.deleteProduct(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new AppError(400, 'No image file provided');
      const imageUrl = await productsService.uploadProductImage(
        req.params.id as string,
        req.file.buffer,
      );
      res.json({ imageUrl });
    } catch (error) {
      next(error);
    }
  }

  // -- ProductSets --

  async listSets(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sets = await productsService.listSets();
      res.json(sets);
    } catch (error) {
      next(error);
    }
  }

  async createSet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const set = await productsService.createSet(req.body);
      res.status(201).json(set);
    } catch (error) {
      next(error);
    }
  }

  async updateSet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const set = await productsService.updateSet(req.params.id as string, req.body);
      res.json(set);
    } catch (error) {
      next(error);
    }
  }

  async removeSet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productsService.deleteSet(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async uploadSetImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) throw new AppError(400, 'No image file provided');
      const imageUrl = await productsService.uploadSetImage(
        req.params.id as string,
        req.file.buffer,
      );
      res.json({ imageUrl });
    } catch (error) {
      next(error);
    }
  }

  // -- ProductTypes --

  async listTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await productsService.listTypes();
      res.json(types);
    } catch (error) {
      next(error);
    }
  }

  async createType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = await productsService.createType(req.body);
      res.status(201).json(type);
    } catch (error) {
      next(error);
    }
  }

  async updateType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = await productsService.updateType(req.params.id as string, req.body);
      res.json(type);
    } catch (error) {
      next(error);
    }
  }

  async removeType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await productsService.deleteType(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
