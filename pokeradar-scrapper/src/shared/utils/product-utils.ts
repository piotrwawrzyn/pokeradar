/**
 * Product utility functions.
 */

import { WatchlistProduct, WatchlistProductInternal, ResolvedWatchlistProduct } from '../types';

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
  products: ResolvedWatchlistProduct[];
}

/**
 * Builds a series index mapping series names to all set names in that series.
 */
function buildSeriesIndex(
  setMap: Map<string, { name: string; series: string }>,
): Map<string, string[]> {
  const seriesIndex = new Map<string, string[]>();
  for (const [, set] of setMap.entries()) {
    if (!seriesIndex.has(set.series)) {
      seriesIndex.set(set.series, []);
    }
    seriesIndex.get(set.series)!.push(set.name);
  }
  return seriesIndex;
}

/**
 * Partitions products into those belonging to known sets and those without sets.
 */
function partitionProductsBySet(
  products: ResolvedWatchlistProduct[],
  setMap: Map<string, { name: string; series: string }>,
): { bySet: Map<string, ResolvedWatchlistProduct[]>; ungrouped: ResolvedWatchlistProduct[] } {
  const bySet = new Map<string, ResolvedWatchlistProduct[]>();
  const ungrouped: ResolvedWatchlistProduct[] = [];

  for (const product of products) {
    if (setMap.has(product.productSetId)) {
      const existing = bySet.get(product.productSetId) || [];
      existing.push(product);
      bySet.set(product.productSetId, existing);
    } else {
      ungrouped.push(product);
    }
  }

  return { bySet, ungrouped };
}

/**
 * Creates a SetGroup with automatic exclusions for generic sets.
 * Generic sets (where name === series) automatically exclude all other sets in the same series.
 */
function createSetGroupWithExclusions(
  setId: string,
  members: ResolvedWatchlistProduct[],
  setMap: Map<string, { name: string; series: string }>,
  seriesIndex: Map<string, string[]>,
): SetGroup {
  const set = setMap.get(setId)!;

  // Auto-exclude other sets in series for generic sets (name === series)
  const otherSetsInSeries =
    set.name === set.series && seriesIndex.has(set.series)
      ? seriesIndex
          .get(set.series)!
          .filter((name) => name !== set.name)
          .map((name) => name.toLowerCase())
      : [];

  const membersWithExcludes = members.map((product) => ({
    ...product,
    search: {
      phrases: product.search.phrases,
      exclude: [...product.search.exclude, ...otherSetsInSeries],
    },
  }));

  return {
    setId,
    searchPhrase: set.name,
    products: membersWithExcludes,
  };
}

/**
 * Groups resolved products by their productSetId.
 * All products with a known set become SetGroups (even single-member sets).
 * Products whose set is not in the setMap are ungrouped.
 *
 * For generic sets (where name === series), automatically excludes all other
 * sets in the same series to prevent cross-set matching conflicts.
 */
export function groupProductsBySet(
  products: ResolvedWatchlistProduct[],
  setMap: Map<string, { name: string; series: string }>,
): { setGroups: SetGroup[]; ungrouped: ResolvedWatchlistProduct[] } {
  const seriesIndex = buildSeriesIndex(setMap);
  const { bySet, ungrouped } = partitionProductsBySet(products, setMap);

  const setGroups: SetGroup[] = [];
  for (const [setId, members] of bySet.entries()) {
    setGroups.push(createSetGroupWithExclusions(setId, members, setMap, seriesIndex));
  }

  return { setGroups, ungrouped };
}
