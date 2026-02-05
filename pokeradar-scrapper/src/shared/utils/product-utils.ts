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
 * Products without a set are ungrouped and use individual search.
 *
 * For generic sets (where name === series), automatically excludes all other
 * sets in the same series to prevent cross-set matching conflicts.
 *
 * @param products - All products to group
 * @param setMap - Map of setId -> { name, series } loaded from ProductSet collection
 */
export function groupProductsBySet(
  products: WatchlistProductInternal[],
  setMap: Map<string, { name: string; series: string }>
): { setGroups: SetGroup[]; ungrouped: WatchlistProductInternal[] } {
  // Build series index: series -> all set names in that series
  const seriesIndex = new Map<string, string[]>();
  for (const [, set] of setMap.entries()) {
    if (!seriesIndex.has(set.series)) {
      seriesIndex.set(set.series, []);
    }
    seriesIndex.get(set.series)!.push(set.name);
  }

  const bySet = new Map<string, WatchlistProductInternal[]>();
  const ungrouped: WatchlistProductInternal[] = [];

  for (const product of products) {
    if (product.productSetId && setMap.has(product.productSetId)) {
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

    // Auto-exclude other sets in series for generic sets (name === series)
    const otherSetsInSeries = (set.name === set.series && seriesIndex.has(set.series))
      ? seriesIndex.get(set.series)!.filter(name => name !== set.name).map(name => name.toLowerCase())
      : [];

    const membersWithExcludes = members.map(product => ({
      ...product,
      search: {
        ...product.search,
        phrases: [...(product.search.phrases || [])],
        exclude: [...(product.search.exclude || []), ...otherSetsInSeries],
      },
    }));

    setGroups.push({
      setId,
      searchPhrase: set.name,
      products: membersWithExcludes,
    });
  }

  return { setGroups, ungrouped };
}
