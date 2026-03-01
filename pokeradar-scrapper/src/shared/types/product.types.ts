/**
 * Product type definitions for watchlist and scraping results.
 */

/**
 * Product to monitor (config format).
 */
export interface WatchlistProduct {
  name: string;
  productSetId: string;
  productTypeId: string;
  disabled?: boolean;
}

/**
 * Internal product representation with auto-generated ID.
 */
export interface WatchlistProductInternal extends WatchlistProduct {
  id: string;
}
