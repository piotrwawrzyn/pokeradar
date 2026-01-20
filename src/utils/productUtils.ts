import { WatchlistProduct, WatchlistProductInternal } from '../types';

/**
 * Converts a product name to a safe kebab-case ID.
 * Examples:
 * - "Prismatic Evolutions Booster Bundle" -> "prismatic-evolutions-booster-bundle"
 * - "151 Booster Bundle" -> "151-booster-bundle"
 */
export function generateProductId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/-+/g, '-');       // Replace multiple hyphens with single hyphen
}

/**
 * Converts a watchlist product to internal representation with ID.
 */
export function toInternalProduct(product: WatchlistProduct): WatchlistProductInternal {
  return {
    ...product,
    id: generateProductId(product.name)
  };
}

/**
 * Converts an array of watchlist products to internal representation.
 */
export function toInternalProducts(products: WatchlistProduct[]): WatchlistProductInternal[] {
  return products.map(toInternalProduct);
}
