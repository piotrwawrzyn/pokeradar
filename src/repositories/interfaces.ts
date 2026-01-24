import { ShopConfig, WatchlistProductInternal } from '../types';

/**
 * Base repository interface for collection access.
 */
export interface ICollectionRepository<T> {
  getAll(): Promise<T[]>;
  getById?(id: string): Promise<T | null>;
}

/**
 * Repository interface for accessing shop configurations.
 */
export interface IShopRepository extends ICollectionRepository<ShopConfig> {
  getEnabled(): Promise<ShopConfig[]>;
}

/**
 * Repository interface for accessing watchlist products.
 */
export interface IWatchlistRepository extends ICollectionRepository<WatchlistProductInternal> {}
