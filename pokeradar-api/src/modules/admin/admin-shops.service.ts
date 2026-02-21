import { loadShopInfos, ShopInfo } from '@pokeradar/shared';
import {
  ProductResultModel,
  WatchlistProductModel,
  ProductSetModel,
} from '../../infrastructure/database/models';

export interface AdminShopSummary {
  shopId: string;
  shopName: string;
  baseUrl: string;
  disabled: boolean;
  findsLastHour: number;
  findsLastWeek: number;
  hasWarning: boolean;
}

export interface AdminShopProduct {
  productId: string;
  productName: string;
  productImageUrl: string;
  productSetId: string | null;
  setReleaseDate: string | null;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  lastSeen: Date;
}

export interface AdminShopDetail {
  shopId: string;
  shopName: string;
  baseUrl: string;
  findsLastHour: number;
  findsLastWeek: number;
  availableCount: number;
  totalCount: number;
  hasWarning: boolean;
  products: AdminShopProduct[];
}

export class AdminShopsService {
  async listShops(): Promise<AdminShopSummary[]> {
    const shops = loadShopInfos();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count unique products per shop from last hour with valid data
    const hourlyCounts = await ProductResultModel.aggregate([
      { $match: { timestamp: { $gte: hourAgo } } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: { shopId: '$shopId', productId: '$productId' },
          productUrl: { $first: '$productUrl' },
          price: { $first: '$price' },
          isAvailable: { $first: '$isAvailable' },
        },
      },
      {
        $match: {
          $and: [
            { productUrl: { $ne: null } },
            { productUrl: { $ne: '' } },
            { $or: [{ isAvailable: true }, { price: { $ne: null } }] },
          ],
        },
      },
      {
        $group: {
          _id: '$_id.shopId',
          count: { $sum: 1 },
        },
      },
    ]);

    const hourlyMap = new Map<string, number>(
      hourlyCounts.map((r: { _id: string; count: number }) => [r._id, r.count]),
    );

    return shops.map((shop: ShopInfo) => {
      const findsLastHour = hourlyMap.get(shop.id) ?? 0;
      return {
        shopId: shop.id,
        shopName: shop.name,
        baseUrl: shop.baseUrl,
        disabled: shop.disabled ?? false,
        findsLastHour,
        findsLastWeek: 0, // Deprecated but kept for backwards compatibility
        hasWarning: !shop.disabled && findsLastHour === 0,
      };
    });
  }

  async getShopDetail(shopId: string): Promise<AdminShopDetail | null> {
    const shops = loadShopInfos();
    const shop = shops.find((s: ShopInfo) => s.id === shopId);
    if (!shop) return null;

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [hourlyCount, weeklyCount, latestResults] = await Promise.all([
      ProductResultModel.countDocuments({
        shopId,
        timestamp: { $gte: hourAgo },
      }),
      ProductResultModel.countDocuments({
        shopId,
        timestamp: { $gte: weekAgo },
      }),
      ProductResultModel.aggregate([
        { $match: { shopId, timestamp: { $gte: hourAgo } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$productId',
            productId: { $first: '$productId' },
            price: { $first: '$price' },
            isAvailable: { $first: '$isAvailable' },
            productUrl: { $first: '$productUrl' },
            lastSeen: { $first: '$timestamp' },
          },
        },
        {
          $match: {
            $and: [
              { productUrl: { $ne: null } },
              { productUrl: { $ne: '' } },
              { $or: [{ isAvailable: true }, { price: { $ne: null } }] },
            ],
          },
        },
        { $sort: { lastSeen: -1 } },
      ]),
    ]);

    const productIds = latestResults.map((r: { productId: string }) => r.productId);
    const products = await WatchlistProductModel.find({ id: { $in: productIds } })
      .select('id name imageUrl productSetId')
      .lean();
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Get unique set IDs and fetch set data
    const setIds = [
      ...new Set(products.map((p) => p.productSetId).filter((id): id is string => Boolean(id))),
    ];
    const sets =
      setIds.length > 0
        ? await ProductSetModel.find({ id: { $in: setIds } })
            .select('id releaseDate')
            .lean()
        : [];
    const setMap = new Map(sets.map((s) => [s.id, s]));

    const availableCount = latestResults.filter((r: any) => r.isAvailable).length;
    const totalCount = latestResults.length;

    return {
      shopId: shop.id,
      shopName: shop.name,
      baseUrl: shop.baseUrl,
      findsLastHour: hourlyCount,
      findsLastWeek: weeklyCount,
      availableCount,
      totalCount,
      hasWarning: !shop.disabled && hourlyCount === 0,
      products: latestResults.map((r: any) => {
        const product = productMap.get(r.productId);
        const setId = product?.productSetId;
        const releaseDate = setId ? setMap.get(setId)?.releaseDate : null;
        return {
          productId: r.productId,
          productName: product?.name ?? r.productId,
          productImageUrl: product?.imageUrl ?? '',
          productSetId: setId ?? null,
          setReleaseDate: releaseDate ? releaseDate.toISOString() : null,
          price: r.price,
          isAvailable: r.isAvailable,
          productUrl: r.productUrl,
          lastSeen: r.lastSeen,
        };
      }),
    };
  }
}
