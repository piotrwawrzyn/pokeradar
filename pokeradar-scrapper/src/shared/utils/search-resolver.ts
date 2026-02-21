/**
 * Search Resolver — resolves the effective search config for each product.
 *
 * ## Background
 *
 * Each product in the watchlist needs search phrases (used to find the product
 * on shop websites) and optional exclude words (used to filter out false matches).
 *
 * Previously, every product defined its own `search.phrases` and `search.exclude`
 * directly. This led to repetition — e.g. every "Booster Box" product had the same
 * exclude words like "kiosk", "half", "case", "elite".
 *
 * ## ProductType
 *
 * A `ProductType` (e.g. "Booster Box", "Poster Collection") defines shared search
 * config that multiple products can inherit. Products reference a type via
 * `productTypeId`.
 *
 * ## Set name joining
 *
 * When a product has both a `productTypeId` and a `productSetId`, the ProductType's
 * phrases are **joined with the set name** to form the actual search query.
 * This joining ONLY applies to phrases from the ProductType, NOT to phrases
 * defined directly on the product.
 *
 * Example:
 *   ProductType "booster-box" has phrase: "Booster Box"
 *   Product belongs to set "sv08" (name: "Surging Sparks")
 *   Resolved phrase: "Surging Sparks Booster Box"
 *
 * If the product has no set, type phrases are NOT used — they would be too generic
 * (e.g. just "Booster Box" matches everything). In that case, only the product's
 * own phrases are used. Type excludes are still merged in.
 *
 * ## Resolution rules
 *
 * 1. **No type, has own search** — use product's own search as-is (legacy behavior)
 *
 *    Product: { search: { phrases: ["Pikachu SWSH039"] } }
 *    Result:  { phrases: ["Pikachu SWSH039"], exclude: [] }
 *
 * 2. **Has type + set, no own search** — build phrases from type (joined with set name)
 *
 *    Type:    { phrases: ["Booster Box"], exclude: ["kiosk", "half"] }
 *    Product: { productSetId: "sv08", productTypeId: "booster-box" }
 *    Set:     { name: "Surging Sparks" }
 *    Result:  { phrases: ["Surging Sparks Booster Box"], exclude: ["kiosk", "half"] }
 *
 * 2b. **Has type but NO set, no own search** — unresolvable (type phrases alone
 *     are too generic, e.g. just "Booster Box"), product is skipped
 *
 * 2c. **Has type but NO set, has own search** — use product's own phrases,
 *     merge type excludes only
 *
 *    Type:    { phrases: ["Booster Box"], exclude: ["kiosk"] }
 *    Product: { productTypeId: "booster-box", search: { phrases: ["Mystery BB"] } }
 *    Result:  { phrases: ["Mystery BB"], exclude: ["kiosk"] }
 *
 * 3. **Has type + own search, override: true** — ignore type entirely
 *
 *    Type:    { phrases: ["Booster Box"], exclude: ["kiosk"] }
 *    Product: { productTypeId: "booster-box", search: { phrases: ["Special BB"], override: true } }
 *    Result:  { phrases: ["Special BB"], exclude: [] }
 *
 * 4. **Has type + own search, no override (merge)** — combine both
 *
 *    Type:    { phrases: ["Booster Box"], exclude: ["kiosk"] }
 *    Product: { productSetId: "sv08", productTypeId: "booster-box", search: { phrases: ["SV08 display"], exclude: ["tin"] } }
 *    Set:     { name: "Surging Sparks" }
 *    Result:  { phrases: ["SV08 display", "Surging Sparks Booster Box"], exclude: ["kiosk", "tin"] }
 *
 *    Product's own phrases come first (searched first), then type-derived phrases.
 *    Excludes are merged (type excludes + product excludes), deduplicated.
 *
 * 5. **No type AND no search** — unresolvable, product is skipped with a warning
 *
 * ## How resolved search is used downstream
 *
 * After resolution, each product has a guaranteed `search.phrases[]` and
 * `search.exclude[]`. The scraper uses these to:
 *
 * - Build search URLs: each phrase becomes a search query on the shop website
 *   (e.g. "https://shop.com/search?q=Surging+Sparks+Booster+Box")
 * - Validate results: when a shop returns search results, the product title
 *   is fuzzy-matched against the phrase using fuzzball's token_set_ratio
 *   (threshold: 95). If any exclude word appears in the title (case-insensitive
 *   substring match), the result is rejected.
 * - The scraper tries each phrase in order and returns the first match found.
 */

import { WatchlistProductInternal, ResolvedWatchlistProduct } from '../types';
import { ProductTypeModel } from '../../infrastructure/database/models';

export interface ProductTypeSearch {
  phrases?: string[];
  exclude?: string[];
}

/**
 * Builds ProductType-derived phrases by joining with the set name.
 * If the product has no set, returns empty — type phrases alone are too generic.
 *
 * @example
 * buildTypePhrases(["Booster Box"], "Surging Sparks")
 * // => ["Surging Sparks Booster Box"]
 *
 * buildTypePhrases(["Booster Box"], undefined)
 * // => [] (no set = too generic, don't use type phrases)
 */
function buildTypePhrases(typePhrases: string[], setName: string | undefined): string[] {
  if (!setName) {
    return [];
  }
  return typePhrases.map((phrase) => `${setName} ${phrase}`.toLowerCase());
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
 * Combines the product's own search config with its ProductType's search config
 * (if any), applying set-name joining and merge/override rules.
 *
 * @returns A product with guaranteed `search.phrases` and `search.exclude`,
 *          or `null` if no search can be determined.
 */
export function resolveSearchConfig(
  product: WatchlistProductInternal,
  productTypeMap: Map<string, ProductTypeSearch>,
  setMap: Map<string, { name: string; series: string }>,
): ResolvedWatchlistProduct | null {
  const productPhrases = product.search?.phrases ?? [];
  const productExclude = product.search?.exclude ?? [];
  const hasProductSearch = productPhrases.length > 0 || productExclude.length > 0;

  // No type — use product's own search
  if (!product.productTypeId) {
    if (!hasProductSearch && productPhrases.length === 0) {
      return null;
    }
    return {
      ...product,
      search: {
        phrases: productPhrases,
        exclude: productExclude,
      },
    };
  }

  const productType = productTypeMap.get(product.productTypeId);
  if (!productType) {
    // Type referenced but not found in DB — fall back to product's own search
    if (productPhrases.length === 0 && !hasProductSearch) {
      return null;
    }
    return {
      ...product,
      search: {
        phrases: productPhrases,
        exclude: productExclude,
      },
    };
  }

  // Override — product explicitly ignores its type's search
  if (product.search?.override) {
    return {
      ...product,
      search: {
        phrases: productPhrases,
        exclude: productExclude,
      },
    };
  }

  // Build type-derived phrases (joined with set name if product belongs to a set)
  const setName = product.productSetId ? setMap.get(product.productSetId)?.name : undefined;
  const typePhrases = buildTypePhrases(productType.phrases ?? [], setName);
  const typeExclude = productType.exclude ?? [];

  // Merge: product's own phrases first, then type-derived; excludes combined
  const mergedPhrases = dedupe([...productPhrases, ...typePhrases]);
  const mergedExclude = dedupe([...typeExclude, ...productExclude]);

  if (mergedPhrases.length === 0) {
    return null;
  }

  return {
    ...product,
    search: {
      phrases: mergedPhrases,
      exclude: mergedExclude,
    },
  };
}

/**
 * Resolves search config for all products, filtering out unresolvable ones.
 * Products with no resolvable search (no type and no search defined) are
 * logged and excluded from the result.
 */
export function resolveAllProducts(
  products: WatchlistProductInternal[],
  productTypeMap: Map<string, ProductTypeSearch>,
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
 * Use this instead of calling resolveAllProducts() directly — it handles the
 * ProductType DB query so callers don't need to duplicate that logic.
 */
export async function loadAndResolveProducts(
  products: WatchlistProductInternal[],
  setMap: Map<string, { name: string; series: string }>,
  logger?: { error(message: string, meta?: Record<string, unknown>): void },
): Promise<{ resolved: ResolvedWatchlistProduct[]; productTypeCount: number }> {
  const productTypeDocs = await ProductTypeModel.find().lean();
  const productTypeMap = new Map<string, ProductTypeSearch>();
  for (const doc of productTypeDocs) {
    productTypeMap.set(doc.id, {
      phrases: doc.search?.phrases,
      exclude: doc.search?.exclude,
    });
  }

  const resolved = resolveAllProducts(products, productTypeMap, setMap, logger);

  return { resolved, productTypeCount: productTypeMap.size };
}
