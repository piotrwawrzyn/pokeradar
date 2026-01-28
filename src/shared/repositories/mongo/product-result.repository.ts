/**
 * MongoDB implementation of product result repository.
 */

import { ProductResult } from '../../types';
import { IProductResultRepository } from '../interfaces';
import { ProductResultModel } from '../../../infrastructure/database/models';
import { toProductResult, toProductResultArray, getHourBucket } from './mappers';

export class MongoProductResultRepository implements IProductResultRepository {
  async save(result: ProductResult): Promise<void> {
    await ProductResultModel.create({
      productId: result.productId,
      shopId: result.shopId,
      hourBucket: getHourBucket(result.timestamp),
      productUrl: result.productUrl,
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
        price: r.price,
        isAvailable: r.isAvailable,
        timestamp: r.timestamp,
      }))
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
    return toProductResultArray(docs as any[]);
  }

  async getCurrentBestOffer(productId: string): Promise<ProductResult | null> {
    const [doc] = await ProductResultModel.aggregate([
      { $match: { productId, isAvailable: true, price: { $ne: null } } },
      { $sort: { shopId: 1, timestamp: -1 } },
      { $group: { _id: '$shopId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { price: 1 } },
      { $limit: 1 },
    ]);

    if (!doc) return null;
    return toProductResult(doc);
  }

  async getBestOffersForProducts(productIds: string[]): Promise<Map<string, ProductResult>> {
    if (productIds.length === 0) return new Map();

    const docs = await ProductResultModel.aggregate([
      { $match: { productId: { $in: productIds }, isAvailable: true, price: { $ne: null } } },
      { $sort: { productId: 1, shopId: 1, timestamp: -1 } },
      { $group: { _id: { productId: '$productId', shopId: '$shopId' }, doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
      { $sort: { productId: 1, price: 1 } },
      { $group: { _id: '$productId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ]);

    const result = new Map<string, ProductResult>();
    for (const doc of docs) {
      result.set(doc.productId, toProductResult(doc));
    }
    return result;
  }

  async getRecent(limit = 100): Promise<ProductResult[]> {
    const docs = await ProductResultModel.find().sort({ timestamp: -1 }).limit(limit).lean();
    return toProductResultArray(docs as any[]);
  }
}
