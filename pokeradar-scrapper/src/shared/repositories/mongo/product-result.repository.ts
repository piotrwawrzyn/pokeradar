/**
 * MongoDB implementation of product result repository.
 */

import { IProductResultRepository } from '../interfaces';
import {
  ProductResult,
  ProductResultModel,
  getFreshnessCutoff,
  buildBestPriceAggregation,
} from '@pokeradar/shared';
import { toProductResult, toProductResultArray, getHourBucket, IProductResultDoc } from './mappers';

export class MongoProductResultRepository implements IProductResultRepository {
  async save(result: ProductResult): Promise<void> {
    await ProductResultModel.create({
      productId: result.productId,
      shopId: result.shopId,
      hourBucket: getHourBucket(result.timestamp),
      productUrl: result.productUrl,
      productTitle: result.productTitle,
      price: result.price,
      isAvailable: result.isAvailable,
      timestamp: result.timestamp,
    });
  }

  async saveBatch(results: ProductResult[]): Promise<void> {
    if (results.length === 0) return;

    await ProductResultModel.insertMany(
      results.map((r) => ({
        productId: r.productId,
        shopId: r.shopId,
        hourBucket: getHourBucket(r.timestamp),
        productUrl: r.productUrl,
        productTitle: r.productTitle,
        price: r.price,
        isAvailable: r.isAvailable,
        timestamp: r.timestamp,
      })),
    );
  }

  async upsertHourlyBatch(results: ProductResult[]): Promise<void> {
    if (results.length === 0) return;

    const operations = results.map((result) => {
      const hourBucket = getHourBucket(result.timestamp);
      return {
        updateOne: {
          filter: {
            productId: result.productId,
            shopId: result.shopId,
            hourBucket,
          },
          update: {
            $set: {
              productUrl: result.productUrl,
              productTitle: result.productTitle,
              price: result.price,
              isAvailable: result.isAvailable,
              timestamp: result.timestamp,
            },
            $setOnInsert: {
              productId: result.productId,
              shopId: result.shopId,
              hourBucket,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    await ProductResultModel.bulkWrite(operations, { ordered: false });
  }

  async getByProduct(productId: string, shopId: string, limit = 100): Promise<ProductResult[]> {
    const docs = await ProductResultModel.find({ productId, shopId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return toProductResultArray(docs as IProductResultDoc[]);
  }

  async getCurrentBestOffer(productId: string): Promise<ProductResult | null> {
    const [doc] = await ProductResultModel.aggregate([
      {
        $match: {
          productId,
          isAvailable: true,
          price: { $ne: null },
          timestamp: { $gte: getFreshnessCutoff() },
        },
      },
      { $sort: { shopId: 1, timestamp: -1 } },
      { $group: { _id: '$shopId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { price: 1 } },
      { $limit: 1 },
    ]);

    if (!doc) return null;
    return toProductResult(doc);
  }

  async getBestOffersForProducts(productIds: string[]): Promise<Map<string, ProductResult | null>> {
    if (productIds.length === 0) return new Map();

    const cutoff = getFreshnessCutoff();

    // Find which products have any fresh data (even if unavailable)
    const productsWithFreshData = await ProductResultModel.distinct('productId', {
      productId: { $in: productIds },
      timestamp: { $gte: cutoff },
    });
    const freshSet = new Set<string>(productsWithFreshData);

    // Find best available offers among fresh results
    const pipeline = buildBestPriceAggregation(productIds, cutoff);
    const docs = await ProductResultModel.aggregate(pipeline);

    // null = fresh data exists but nothing available, absent from map = no fresh data at all
    const result = new Map<string, ProductResult | null>();
    for (const pid of freshSet) {
      result.set(pid, null);
    }
    for (const doc of docs) {
      result.set(doc.productId, toProductResult(doc));
    }
    return result;
  }

  async getRecent(limit = 100): Promise<ProductResult[]> {
    const docs = await ProductResultModel.find().sort({ timestamp: -1 }).limit(limit).lean();
    return toProductResultArray(docs as IProductResultDoc[]);
  }
}
