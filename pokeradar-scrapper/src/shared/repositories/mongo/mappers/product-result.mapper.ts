/**
 * Mapper for ProductResult document to domain model conversion.
 */

import { ProductResult } from '../../../types';

/**
 * ProductResult document interface (from MongoDB).
 */
export interface IProductResultDoc {
  productId: string;
  shopId: string;
  hourBucket: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
  createdAt?: Date;
}

/**
 * Generates an hour bucket string from a date.
 * Format: "YYYY-MM-DDTHH" (e.g., "2026-01-26T14")
 */
export function getHourBucket(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/**
 * Maps a MongoDB document to ProductResult domain model.
 */
export function toProductResult(doc: IProductResultDoc): ProductResult {
  return {
    productId: doc.productId,
    shopId: doc.shopId,
    productUrl: doc.productUrl,
    price: doc.price,
    isAvailable: doc.isAvailable,
    timestamp: doc.timestamp,
  };
}

/**
 * Maps an array of MongoDB documents to ProductResult domain models.
 */
export function toProductResultArray(docs: IProductResultDoc[]): ProductResult[] {
  return docs.map(toProductResult);
}

/**
 * Maps a ProductResult domain model to MongoDB document fields.
 */
export function toProductResultDoc(result: ProductResult): Omit<IProductResultDoc, 'createdAt'> {
  return {
    productId: result.productId,
    shopId: result.shopId,
    hourBucket: getHourBucket(result.timestamp),
    productUrl: result.productUrl,
    price: result.price,
    isAvailable: result.isAvailable,
    timestamp: result.timestamp,
  };
}
