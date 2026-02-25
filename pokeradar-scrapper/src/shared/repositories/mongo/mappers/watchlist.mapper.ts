/**
 * Mapper for WatchlistProduct document to domain model conversion.
 */

import { IWatchlistProductDoc } from '@pokeradar/shared';
import { WatchlistProductInternal } from '../../../types';

/**
 * Maps a MongoDB document to WatchlistProductInternal domain model.
 */
export function toWatchlistProduct(doc: IWatchlistProductDoc): WatchlistProductInternal {
  return {
    id: doc.id,
    name: doc.name,
    productSetId: doc.productSetId,
    productTypeId: doc.productTypeId,
    searchOverride: doc.searchOverride
      ? {
          additionalRequired: doc.searchOverride.additionalRequired,
          additionalForbidden: doc.searchOverride.additionalForbidden,
          customPhrase: doc.searchOverride.customPhrase,
        }
      : undefined,
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
