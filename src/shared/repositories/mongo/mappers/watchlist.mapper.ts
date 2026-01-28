/**
 * Mapper for WatchlistProduct document to domain model conversion.
 */

import { WatchlistProductInternal } from '../../../types';

/**
 * WatchlistProduct document interface (from MongoDB).
 */
export interface IWatchlistProductDoc {
  id: string;
  name: string;
  search: {
    phrases: string[];
    exclude?: string[];
  };
  price: {
    max: number;
    min?: number;
  };
}

/**
 * Maps a MongoDB document to WatchlistProductInternal domain model.
 */
export function toWatchlistProduct(doc: IWatchlistProductDoc): WatchlistProductInternal {
  return {
    id: doc.id,
    name: doc.name,
    search: {
      phrases: doc.search.phrases,
      exclude: doc.search.exclude,
    },
    price: {
      max: doc.price.max,
      min: doc.price.min,
    },
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
export function toWatchlistProductDoc(product: WatchlistProductInternal): IWatchlistProductDoc {
  return {
    id: product.id,
    name: product.name,
    search: {
      phrases: product.search.phrases,
      exclude: product.search.exclude,
    },
    price: {
      max: product.price.max,
      min: product.price.min,
    },
  };
}
