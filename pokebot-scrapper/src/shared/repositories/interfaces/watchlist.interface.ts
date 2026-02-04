/**
 * Watchlist repository interface.
 */

import { WatchlistProductInternal } from '../../types';
import { ICollectionRepository } from './collection.interface';

/**
 * Repository interface for accessing watchlist products.
 */
export interface IWatchlistRepository extends ICollectionRepository<WatchlistProductInternal> {
  add?(product: WatchlistProductInternal): Promise<void>;
  update?(product: WatchlistProductInternal): Promise<void>;
  delete?(id: string): Promise<void>;
}
