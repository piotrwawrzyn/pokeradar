import * as fs from 'fs';
import { Watchlist, WatchlistProductInternal } from '../types';
import { IWatchlistRepository } from './interfaces';
import { toInternalProducts } from '../utils/productUtils';

/**
 * File-based implementation of watchlist repository.
 * Reads watchlist from a JSON file.
 */
export class FileWatchlistRepository implements IWatchlistRepository {
  constructor(private watchlistPath: string) {}

  async getAll(): Promise<WatchlistProductInternal[]> {
    const content = fs.readFileSync(this.watchlistPath, 'utf-8');
    const watchlist: Watchlist = JSON.parse(content);
    return toInternalProducts(watchlist.products);
  }
}
