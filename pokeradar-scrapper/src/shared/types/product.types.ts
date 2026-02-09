/**
 * Product type definitions for watchlist and scraping results.
 */

/**
 * Search configuration for a product.
 */
export interface SearchConfig {
  phrases?: string[];
  exclude?: string[];
  override?: boolean;
}

/**
 * Product to monitor (config format).
 */
export interface WatchlistProduct {
  name: string;
  productSetId?: string;
  productTypeId?: string;
  search?: SearchConfig;
  disabled?: boolean;
}

/**
 * Internal product representation with auto-generated ID.
 */
export interface WatchlistProductInternal extends WatchlistProduct {
  id: string;
}

/**
 * A product with fully resolved search config (guaranteed non-optional).
 * Produced by search-resolver after merging ProductType + product search.
 */
export interface ResolvedWatchlistProduct extends WatchlistProductInternal {
  search: {
    phrases: string[];
    exclude: string[];
  };
}

/**
 * Scraping result for a product.
 */
export interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}
