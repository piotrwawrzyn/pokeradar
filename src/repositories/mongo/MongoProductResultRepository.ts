import { ProductResult } from '../../types';
import { IProductResultRepository } from '../interfaces';
import { ProductResultModel } from './models';

/**
 * MongoDB implementation of product result repository.
 * Results auto-expire after 7 days via TTL index.
 */
export class MongoProductResultRepository implements IProductResultRepository {
  async save(result: ProductResult): Promise<void> {
    await ProductResultModel.create({
      productId: result.productId,
      shopId: result.shopId,
      productUrl: result.productUrl,
      price: result.price,
      isAvailable: result.isAvailable,
      timestamp: result.timestamp
    });
  }

  async saveBatch(results: ProductResult[]): Promise<void> {
    if (results.length === 0) return;

    await ProductResultModel.insertMany(
      results.map(r => ({
        productId: r.productId,
        shopId: r.shopId,
        productUrl: r.productUrl,
        price: r.price,
        isAvailable: r.isAvailable,
        timestamp: r.timestamp
      }))
    );
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

  async getBestPrice(productId: string, shopId?: string): Promise<ProductResult | null> {
    const query: { productId: string; shopId?: string; price: { $ne: null } } = {
      productId,
      price: { $ne: null }
    };

    if (shopId) {
      query.shopId = shopId;
    }

    const doc = await ProductResultModel
      .findOne(query)
      .sort({ price: 1 })
      .lean();

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
