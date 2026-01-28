/**
 * Product result repository interface.
 */

import { ProductResult } from '../../types';

/**
 * Repository interface for product result history.
 */
export interface IProductResultRepository {
  save(result: ProductResult): Promise<void>;
  saveBatch(results: ProductResult[]): Promise<void>;
  /** Upsert results with hourly deduplication - 1 record per product/shop/hour */
  upsertHourlyBatch(results: ProductResult[]): Promise<void>;
  getByProduct(productId: string, shopId: string, limit?: number): Promise<ProductResult[]>;
  getCurrentBestOffer(productId: string): Promise<ProductResult | null>;
  /** Get best offers for multiple products in a single query */
  getBestOffersForProducts(productIds: string[]): Promise<Map<string, ProductResult>>;
  getRecent(limit?: number): Promise<ProductResult[]>;
}
