import { ProductResult } from '../../types';
import { IProductResultRepository } from '../interfaces';
import { ProductResultModel } from './models';

/**
 * Generates an hour bucket string from a date.
 * Format: "YYYY-MM-DDTHH" (e.g., "2026-01-26T14")
 */
function getHourBucket(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/**
 * MongoDB implementation of product result repository.
 * Results auto-expire after 1 hour via TTL index.
 */
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
      scanCount: 1
    });
  }

  async saveBatch(results: ProductResult[]): Promise<void> {
    if (results.length === 0) return;

    await ProductResultModel.insertMany(
      results.map(r => ({
        productId: r.productId,
        shopId: r.shopId,
        hourBucket: getHourBucket(r.timestamp),
        productUrl: r.productUrl,
        price: r.price,
        isAvailable: r.isAvailable,
        timestamp: r.timestamp,
        scanCount: 1
      }))
    );
  }

  /**
   * Upsert results with hourly deduplication.
   * Only 1 record per product/shop/hour - subsequent scans update the same record.
   * Uses bulkWrite for efficiency (single round trip).
   */
  async upsertHourlyBatch(results: ProductResult[]): Promise<void> {
    if (results.length === 0) return;

    const operations = results.map(result => {
      const hourBucket = getHourBucket(result.timestamp);
      return {
        updateOne: {
          filter: {
            productId: result.productId,
            shopId: result.shopId,
            hourBucket
          },
          update: {
            $set: {
              productUrl: result.productUrl,
              price: result.price,
              isAvailable: result.isAvailable,
              timestamp: result.timestamp
            },
            $inc: { scanCount: 1 },
            $setOnInsert: {
              productId: result.productId,
              shopId: result.shopId,
              hourBucket,
              createdAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

    await ProductResultModel.bulkWrite(operations, { ordered: false });
  }

  async getByProduct(productId: string, shopId: string, limit = 100): Promise<ProductResult[]> {
    const docs = await ProductResultModel
      .find({ productId, shopId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return docs.map(doc => ({
      productId: doc.productId,
      shopId: doc.shopId,
      productUrl: doc.productUrl,
      price: doc.price,
      isAvailable: doc.isAvailable,
      timestamp: doc.timestamp
    }));
  }

  async getCurrentBestOffer(
    productId: string
  ): Promise<ProductResult | null> {

    const [doc] = await ProductResultModel.aggregate([
      {
        $match: {
          productId,
          isAvailable: true,
          price: { $ne: null }
        }
      },
      {
        $sort: {
          shopId: 1,
          timestamp: -1
        }
      },
      {
        $group: {
          _id: '$shopId',
          doc: { $first: '$$ROOT' } // latest result per shop
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      {
        $sort: { price: 1 } // cheapest current offer wins
      },
      {
        $limit: 1
      }
    ]);

    if (!doc) return null;

    return {
      productId: doc.productId,
      shopId: doc.shopId,
      productUrl: doc.productUrl,
      price: doc.price,
      isAvailable: doc.isAvailable,
      timestamp: doc.timestamp
    };
  }

  /**
   * Get best offers for multiple products in a single aggregation query.
   * Returns a Map of productId -> best ProductResult.
   */
  async getBestOffersForProducts(
    productIds: string[]
  ): Promise<Map<string, ProductResult>> {
    if (productIds.length === 0) return new Map();

    const docs = await ProductResultModel.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          isAvailable: true,
          price: { $ne: null }
        }
      },
      {
        $sort: {
          productId: 1,
          shopId: 1,
          timestamp: -1
        }
      },
      {
        // Get latest result per product/shop combination
        $group: {
          _id: { productId: '$productId', shopId: '$shopId' },
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      },
      {
        $sort: { productId: 1, price: 1 }
      },
      {
        // Get cheapest offer per product
        $group: {
          _id: '$productId',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$doc' }
      }
    ]);

    const result = new Map<string, ProductResult>();
    for (const doc of docs) {
      result.set(doc.productId, {
        productId: doc.productId,
        shopId: doc.shopId,
        productUrl: doc.productUrl,
        price: doc.price,
        isAvailable: doc.isAvailable,
        timestamp: doc.timestamp
      });
    }
    return result;
  }
  async getRecent(limit = 100): Promise<ProductResult[]> {
    const docs = await ProductResultModel
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return docs.map(doc => ({
      productId: doc.productId,
      shopId: doc.shopId,
      productUrl: doc.productUrl,
      price: doc.price,
      isAvailable: doc.isAvailable,
      timestamp: doc.timestamp
    }));
  }
}
