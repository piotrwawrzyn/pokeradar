import { ShopConfig, WatchlistProductInternal, NotificationState, ProductResult } from '../types';

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
export interface IWatchlistRepository extends ICollectionRepository<WatchlistProductInternal> {
  add?(product: WatchlistProductInternal): Promise<void>;
  update?(product: WatchlistProductInternal): Promise<void>;
  delete?(id: string): Promise<void>;
}

/**
 * Repository interface for notification state persistence.
 * Key format: {productId}:{shopId}
 */
export interface INotificationStateRepository {
  get(productId: string, shopId: string): Promise<NotificationState | null>;
  set(state: NotificationState): Promise<void>;
  delete(productId: string, shopId: string): Promise<void>;
  getAll(): Promise<NotificationState[]>;
}

/**
 * Repository interface for product result history.
 */
export interface IProductResultRepository {
  save(result: ProductResult): Promise<void>;
  saveBatch(results: ProductResult[]): Promise<void>;
  getByProduct(productId: string, shopId: string, limit?: number): Promise<ProductResult[]>;
  getBestPrice(productId: string, shopId?: string): Promise<ProductResult | null>;
  getRecent(limit?: number): Promise<ProductResult[]>;
}
