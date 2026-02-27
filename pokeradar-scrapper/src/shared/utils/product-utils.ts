/**
 * Product utility functions.
 */

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
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
}

/**
 * Converts a watchlist product to internal representation with ID.
 */
export function toInternalProduct(product: WatchlistProduct): WatchlistProductInternal {
  return {
    ...product,
    id: generateProductId(product.name),
  };
}

/**
 * Converts an array of watchlist products to internal representation.
 */
export function toInternalProducts(products: WatchlistProduct[]): WatchlistProductInternal[] {
  return products.map(toInternalProduct);
}

/**
 * A group of products belonging to the same Pokemon TCG set.
 */
export interface SetGroup {
  setId: string;
  searchPhrase: string;
  products: WatchlistProductInternal[];
}

/**
 * Groups products by their productSetId.
 * All products with a known set become SetGroups (even single-member sets).
 * Products whose set is not in the setMap are ungrouped.
 */
export function groupProductsBySet(
  products: WatchlistProductInternal[],
  setMap: Map<string, { name: string; series: string }>,
): { setGroups: SetGroup[]; ungrouped: WatchlistProductInternal[] } {
  const bySet = new Map<string, WatchlistProductInternal[]>();
  const ungrouped: WatchlistProductInternal[] = [];

  for (const product of products) {
    if (setMap.has(product.productSetId)) {
      const existing = bySet.get(product.productSetId) || [];
      existing.push(product);
      bySet.set(product.productSetId, existing);
    } else {
      ungrouped.push(product);
    }
  }

  const setGroups: SetGroup[] = [];
  for (const [setId, members] of bySet.entries()) {
    const set = setMap.get(setId)!;
    setGroups.push({ setId, searchPhrase: set.name, products: members });
  }

  return { setGroups, ungrouped };
}
