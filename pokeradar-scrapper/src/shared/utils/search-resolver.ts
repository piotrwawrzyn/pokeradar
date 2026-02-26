/**
 * Search Resolver — resolves the effective search config for each product.
 *
 * Every product has a mandatory `productTypeId` and `productSetId`.
 * The ProductType defines a `matchingProfile` with `required` tokens
 * (e.g. "Booster Box") and `forbidden` tokens (e.g. "kiosk", "half").
 *
 * Resolution joins the type's required tokens with the product's set name
 * to form search phrases, and passes forbidden tokens as the exclude list.
 *
 * Example:
 *   ProductType "booster-box": matchingProfile.required = ["Booster Box"]
 *   Product set "sv08": name = "Surging Sparks"
 *   Resolved: { phrases: ["surging sparks booster box"], exclude: ["kiosk", "half"] }
 *
 * After resolution, each product has guaranteed `search.phrases[]` and
 * `search.exclude[]`. The scraper uses these to build search URLs and
 * validate results via fuzzy matching.
 */

import { WatchlistProductInternal, ResolvedWatchlistProduct } from '../types';
import { ProductTypeModel } from '../../infrastructure/database/models';

export interface ProductTypeMatchingProfile {
  required: string[];
  forbidden: string[];
}

/**
 * Builds search phrases by joining each required token with the set name.
 *
 * @example
 * buildSearchPhrases(["Booster Box"], "Surging Sparks")
 * // => ["surging sparks booster box"]
 */
function buildSearchPhrases(requiredTokens: string[], setName: string): string[] {
  return requiredTokens.map((token) => `${setName} ${token}`.toLowerCase());
}

/**
 * Resolves the effective search config for a single product.
 *
 * Looks up the product's type matching profile and joins required tokens
 * with the set name to form search phrases.
 *
 * @returns A product with guaranteed `search.phrases` and `search.exclude`,
 *          or `null` if the type is not found or produces no phrases.
 */
export function resolveSearchConfig(
  product: WatchlistProductInternal,
  productTypeMap: Map<string, ProductTypeMatchingProfile>,
  setMap: Map<string, { name: string; series: string }>,
): ResolvedWatchlistProduct | null {
  const productType = productTypeMap.get(product.productTypeId);
  if (!productType) {
    return null;
  }

  const setName = setMap.get(product.productSetId)?.name;
  if (!setName) {
    return null;
  }

  const phrases = buildSearchPhrases(productType.required, setName);
  if (phrases.length === 0) {
    return null;
  }

  return {
    ...product,
    search: {
      phrases,
      exclude: productType.forbidden,
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
        productSetId: product.productSetId,
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
