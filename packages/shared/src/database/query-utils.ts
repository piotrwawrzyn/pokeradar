/**
 * Shared MongoDB query utilities used by both scrapper and API.
 */

import type { PipelineStage } from 'mongoose';

/**
 * Returns a Date representing the start of the previous hour.
 * Results older than this cutoff are considered stale.
 */
export function getFreshnessCutoff(): Date {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - 1, 0, 0, 0);
  return cutoff;
}

/**
 * Builds a MongoDB aggregation pipeline that finds the best (cheapest)
 * available price per product, taking only the latest result per shop.
 *
 * Pipeline:
 *   1. Match available + priced + fresh results for given productIds
 *   2. Group by (productId, shopId), keeping latest per shop
 *   3. Group by productId, keeping cheapest across shops
 *
 * Returns raw pipeline stages — caller runs ProductResultModel.aggregate(stages).
 */
export function buildBestPriceAggregation(productIds: string[], cutoff: Date): PipelineStage[] {
  return [
    {
      $match: {
        productId: { $in: productIds },
        isAvailable: true,
        price: { $ne: null },
        timestamp: { $gte: cutoff },
      },
    },
    { $sort: { productId: 1, shopId: 1, timestamp: -1 } },
    {
      $group: {
        _id: { productId: '$productId', shopId: '$shopId' },
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { productId: 1, price: 1 } },
    {
      $group: {
        _id: '$productId',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ];
}
