/**
 * Mapper for WatchlistProduct document to domain model conversion.
 */

import { IWatchlistProductDoc } from '@pokeradar/shared';
import { WatchlistProductInternal } from '../../../types';

/**
 * Maps a MongoDB document to WatchlistProductInternal domain model.
 */
export function toWatchlistProduct(doc: IWatchlistProductDoc): WatchlistProductInternal {
  // Support both migrated (searchOverride) and legacy (search) schemas.
  // Legacy docs have: search.phrases[], search.exclude[], search.override (bool)
  const legacy = (doc as any).search as
    | { phrases?: string[]; exclude?: string[]; override?: boolean }
    | undefined;

  let searchOverride = doc.searchOverride
    ? {
        additionalRequired: doc.searchOverride.additionalRequired,
        additionalForbidden: doc.searchOverride.additionalForbidden,
        customPhrase: doc.searchOverride.customPhrase,
      }
    : undefined;

  // If not yet migrated and legacy search exists, synthesise a searchOverride
  if (!searchOverride && legacy) {
    const hasPhrases = legacy.phrases && legacy.phrases.length > 0;
    if (hasPhrases) {
      if (legacy.override || !doc.productTypeId) {
        // Full override — use as customPhrase
        searchOverride = {
          customPhrase: legacy.phrases!.join(' '),
          additionalRequired: undefined,
          additionalForbidden: legacy.exclude,
        };
      } else {
        // Has productTypeId — treat as additionalRequired
        searchOverride = {
          additionalRequired: legacy.phrases,
          additionalForbidden: legacy.exclude,
          customPhrase: undefined,
        };
      }
    } else if (legacy.exclude && legacy.exclude.length > 0) {
      searchOverride = {
        additionalForbidden: legacy.exclude,
        additionalRequired: undefined,
        customPhrase: undefined,
      };
    }
  }

  return {
    id: doc.id,
    name: doc.name,
    productSetId: doc.productSetId,
    productTypeId: doc.productTypeId,
    searchOverride,
    disabled: doc.disabled,
  };
}

/**
 * Maps an array of MongoDB documents to WatchlistProductInternal domain models.
 */
export function toWatchlistProductArray(docs: IWatchlistProductDoc[]): WatchlistProductInternal[] {
  return docs.map(toWatchlistProduct);
}

/**
 * Maps a WatchlistProductInternal domain model to MongoDB document fields.
 */
export function toWatchlistProductDoc(
  product: WatchlistProductInternal,
): Partial<IWatchlistProductDoc> {
  return {
    id: product.id,
    name: product.name,
    productSetId: product.productSetId,
    productTypeId: product.productTypeId,
    searchOverride: product.searchOverride
      ? {
          additionalRequired: product.searchOverride.additionalRequired,
          additionalForbidden: product.searchOverride.additionalForbidden,
          customPhrase: product.searchOverride.customPhrase,
        }
      : undefined,
    disabled: product.disabled,
  };
}
