/**
 * MongoDB repository for UserWatchEntry (read-only).
 */

import { UserWatchEntryModel } from '../../../infrastructure/database/models';

/**
 * Simplified watch entry for notification processing.
 */
export interface UserWatchInfo {
  userId: string;
  productId: string;
  maxPrice: number;
}

export class MongoUserWatchEntryRepository {
  /**
   * Returns a map of productId → active watchers for the given product IDs.
   * Single DB query for all products.
   */
  async getActiveWatchersByProductIds(productIds: string[]): Promise<Map<string, UserWatchInfo[]>> {
    if (productIds.length === 0) return new Map();

    const entries = await UserWatchEntryModel.find({
      productId: { $in: productIds },
      isActive: { $ne: false },
    }).lean();

    const map = new Map<string, UserWatchInfo[]>();
    for (const entry of entries) {
      const list = map.get(entry.productId) || [];
      list.push({
        userId: entry.userId.toString(),
        productId: entry.productId,
        maxPrice: entry.maxPrice,
      });
      map.set(entry.productId, list);
    }
    return map;
  }
}
