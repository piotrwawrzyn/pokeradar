/**
 * Product type definitions for watchlist and scraping results.
 */

/**
 * Search configuration for a product.
 */
export interface SearchConfig {
  phrases: string[];
  exclude?: string[]; // Words that invalidate a match if found in title
}

/**
 * Price constraints for a product.
 */
export interface PriceConfig {
  max: number;
  min?: number; // Optional minimum price threshold
}

/**
 * Product to monitor (config format).
 */
export interface WatchlistProduct {
  name: string;
  search: SearchConfig;
  price: PriceConfig;
}

/**
 * Internal product representation with auto-generated ID.
 */
export interface WatchlistProductInternal extends WatchlistProduct {
  id: string; // Auto-generated from name (kebab-case)
}

/**
 * Watchlist container.
 */
export interface Watchlist {
  products: WatchlistProduct[];
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
