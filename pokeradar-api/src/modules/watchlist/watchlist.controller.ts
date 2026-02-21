import { Request, Response, NextFunction } from 'express';
import { WatchlistService } from './watchlist.service';

const watchlistService = new WatchlistService();

export class WatchlistController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entries = await watchlistService.getUserWatchlist(req.user!.userId);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  }

  async add(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId, maxPrice } = req.body;
      const entry = await watchlistService.addEntry(req.user!.userId, productId, maxPrice);
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await watchlistService.updateEntry(
        req.user!.userId,
        req.params.id as string,
        req.body,
      );
      res.json(entry);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await watchlistService.deleteEntry(req.user!.userId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
