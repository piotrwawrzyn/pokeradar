/**
 * Search Resolver — resolves the effective search config for each product.
 *
 * ## Background
 *
 * Each product in the watchlist needs search phrases (used to find the product
 * on shop websites) and optional exclude words (used to filter out false matches).
 *
 * ## ProductType MatchingProfile
 *
 * A `ProductType` (e.g. "Booster Box", "Poster Collection") defines a MatchingProfile
 * with `required` tokens and `forbidden` tokens that products inherit.
 *
 * ## Set name joining
 *
 * When a product has both a `productTypeId` and a `productSetId`, the ProductType's
 * `required` tokens are **joined with the set name** to form the actual search phrase.
 *
 * Example:
 *   ProductType "booster-box" has required: ["booster", "box"]
 *   Product belongs to set "sv08" (name: "Surging Sparks")
 *   Resolved phrase: "surging sparks booster box"
 *
 * ## Resolution rules
 *
 * 1. **customPhrase set** — use it as the sole phrase (full override, for promos)
 *
 * 2. **Has type + set** — build phrase from required tokens joined with set name,
 *    merge type forbidden + product additionalForbidden
 *
 * 3. **Has type but NO set, no customPhrase** — unresolvable (required tokens alone are
 *    too generic), product is skipped
 *
 * 4. **No type AND no customPhrase** — unresolvable, product is skipped with a warning
 */

import { WatchlistProductInternal, ResolvedWatchlistProduct } from '../types';
import { ProductTypeModel } from '../../infrastructure/database/models';

export interface ProductTypeMatchingProfile {
  required: string[];
  forbidden: string[];
}

/**
 * Builds the search phrase by joining set name with required tokens.
 * Returns empty array if no set name is given (phrase would be too generic).
 *
 * @example
 * buildRequiredPhrase(["booster", "box"], "Surging Sparks")
 * // => ["surging sparks booster box"]
 *
 * buildRequiredPhrase(["booster", "box"], undefined)
 * // => []
 */
function buildRequiredPhrase(required: string[], setName: string | undefined): string[] {
  if (!setName || required.length === 0) {
    return [];
  }
  return [`${setName} ${required.join(' ')}`.toLowerCase()];
}

/**
 * Deduplicates an array of strings (case-insensitive, preserves first occurrence).
 */
function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Resolves the effective search config for a single product.
 *
 * Combines the product's searchOverride with its ProductType's matchingProfile
 * (if any), applying set-name joining and merge rules.
 *
 * @returns A product with guaranteed `search.phrases` and `search.exclude`,
 *          or `null` if no search can be determined.
 */
export function resolveSearchConfig(
  product: WatchlistProductInternal,
  productTypeMap: Map<string, ProductTypeMatchingProfile>,
  setMap: Map<string, { name: string; series: string }>,
): ResolvedWatchlistProduct | null {
  const override = product.searchOverride;

  // Case 1: customPhrase — full override, use as-is
  if (override?.customPhrase) {
    return {
      ...product,
      search: {
        phrases: [override.customPhrase.toLowerCase()],
        exclude: dedupe(override.additionalForbidden ?? []),
      },
    };
  }

  // No type and no customPhrase — unresolvable
  if (!product.productTypeId) {
    return null;
  }

  const productType = productTypeMap.get(product.productTypeId);

  // Type referenced but not found in DB — unresolvable
  if (!productType) {
    return null;
  }

  const setName = product.productSetId ? setMap.get(product.productSetId)?.name : undefined;

  const allRequired = dedupe([...productType.required, ...(override?.additionalRequired ?? [])]);

  const allForbidden = dedupe([...productType.forbidden, ...(override?.additionalForbidden ?? [])]);

  const phrases = buildRequiredPhrase(allRequired, setName);

  if (phrases.length === 0) {
    // Has type but no set — unresolvable (phrase would be too generic)
    return null;
  }

  return {
    ...product,
    search: {
      phrases,
      exclude: allForbidden,
    },
  };
}

/**
 * Resolves search config for all products, filtering out unresolvable ones.
 */
export function resolveAllProducts(
  products: WatchlistProductInternal[],
  productTypeMap: Map<string, ProductTypeMatchingProfile>,
  setMap: Map<string, { name: string; series: string }>,
  logger?: { error(message: string, meta?: Record<string, unknown>): void },
): ResolvedWatchlistProduct[] {
  const resolved: ResolvedWatchlistProduct[] = [];

  for (const product of products) {
    const result = resolveSearchConfig(product, productTypeMap, setMap);
    if (result) {
      resolved.push(result);
    } else {
      logger?.error('Product has no resolvable search config, skipping', {
        productId: product.id,
        productTypeId: product.productTypeId,
      });
    }
  }

  return resolved;
}

/**
 * Loads ProductType docs from MongoDB and resolves search config for all products.
 */
export async function loadAndResolveProducts(
  products: WatchlistProductInternal[],
  setMap: Map<string, { name: string; series: string }>,
  logger?: { error(message: string, meta?: Record<string, unknown>): void },
): Promise<{ resolved: ResolvedWatchlistProduct[]; productTypeCount: number }> {
  const productTypeDocs = await ProductTypeModel.find().lean();
  const productTypeMap = new Map<string, ProductTypeMatchingProfile>();
  for (const doc of productTypeDocs) {
    productTypeMap.set(doc.id, {
      required: doc.matchingProfile?.required ?? [],
      forbidden: doc.matchingProfile?.forbidden ?? [],
    });
  }

  const resolved = resolveAllProducts(products, productTypeMap, setMap, logger);

  return { resolved, productTypeCount: productTypeMap.size };
}
