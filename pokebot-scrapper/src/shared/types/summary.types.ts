/**
 * Summary type definitions.
 */

import { WatchlistProductInternal, ProductResult } from './product.types';

/**
 * Unified best price offer for summary display.
 * Used by both SummaryService and summary entry point.
 */
export interface BestPriceOffer {
  product: WatchlistProductInternal;
  price: number | null;
  shopId: string | null;
  shopName: string | null;
  productUrl: string | null;
  isAvailable: boolean;
}

/**
 * Summary query result pairing product with its best result.
 */
export interface ProductSummary {
  product: WatchlistProductInternal;
  result: ProductResult | null;
}
