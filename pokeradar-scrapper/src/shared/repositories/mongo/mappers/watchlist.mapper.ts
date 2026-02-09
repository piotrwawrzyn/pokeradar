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
    search: doc.search
      ? {
          phrases: doc.search.phrases,
          exclude: doc.search.exclude,
          override: doc.search.override,
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
export function toWatchlistProductDoc(product: WatchlistProductInternal): Partial<IWatchlistProductDoc> {
  return {
    id: product.id,
    name: product.name,
    productSetId: product.productSetId,
    productTypeId: product.productTypeId,
    search: product.search
      ? {
          phrases: product.search.phrases,
          exclude: product.search.exclude,
          override: product.search.override,
        }
      : undefined,
    disabled: product.disabled,
  };
}
