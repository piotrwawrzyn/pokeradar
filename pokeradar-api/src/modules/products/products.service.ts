import { WatchlistProductModel, ProductResultModel } from '../../infrastructure/database/models';
import { Product, ProductWithPrice, ProductPriceResponse } from '../../shared/types';

function getFreshnessCutoff(): Date {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - 1, 0, 0, 0);
  return cutoff;
}

export class ProductsService {
  async listAll(): Promise<ProductWithPrice[]> {
    const docs = await WatchlistProductModel.find()
      .select('id name imageUrl productSetId disabled')
      .lean();

    const products: Product[] = docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      imageUrl: doc.imageUrl,
      productSetId: doc.productSetId,
      disabled: doc.disabled,
    }));

    const productIds = products.map((p) => p.id);
    const priceMap = await this.getBestPrices(productIds);

    return products.map((product) => ({
      ...product,
      currentBestPrice: priceMap.get(product.id)?.bestPrice ?? null,
      currentBestShop: priceMap.get(product.id)?.shopId ?? null,
      currentBestUrl: priceMap.get(product.id)?.productUrl ?? null,
    }));
  }

  async getById(id: string): Promise<Product | null> {
    const doc = await WatchlistProductModel.findOne({ id })
      .select('id name imageUrl productSetId disabled')
      .lean();
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      imageUrl: doc.imageUrl,
      productSetId: doc.productSetId,
      disabled: doc.disabled,
    };
  }

  async getPrices(productId: string): Promise<ProductPriceResponse[]> {
    const cutoff = getFreshnessCutoff();

    const results = await ProductResultModel.aggregate([
      {
        $match: {
          productId,
          timestamp: { $gte: cutoff },
        },
      },
      { $sort: { shopId: 1, timestamp: -1 } },
      {
        $group: {
          _id: '$shopId',
          shopId: { $first: '$shopId' },
          price: { $first: '$price' },
          isAvailable: { $first: '$isAvailable' },
          productUrl: { $first: '$productUrl' },
          timestamp: { $first: '$timestamp' },
        },
      },
      { $sort: { price: 1 } },
    ]);

    return results.map((r) => ({
      shopId: r.shopId,
      price: r.price,
      isAvailable: r.isAvailable,
      productUrl: r.productUrl,
      timestamp: r.timestamp,
    }));
  }

  private async getBestPrices(
    productIds: string[],
  ): Promise<Map<string, { bestPrice: number; shopId: string; productUrl: string }>> {
    if (productIds.length === 0) return new Map();

    const cutoff = getFreshnessCutoff();
    const bestPrices = await ProductResultModel.aggregate([
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
          bestPrice: { $first: '$price' },
          shopId: { $first: '$shopId' },
          productUrl: { $first: '$productUrl' },
        },
      },
    ]);

    return new Map(bestPrices.map((p) => [p._id, p]));
  }
}
