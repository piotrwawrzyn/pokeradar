import { loadShopInfos, ShopInfo } from '@pokeradar/shared';
import {
  WatchlistProductModel,
  ProductResultModel,
  ProductSetModel,
  ProductTypeModel,
  UserWatchEntryModel,
  NotificationStateModel,
  NotificationModel,
} from '../../infrastructure/database/models';
import { NotFoundError, ConflictError } from '../../shared/middleware';
import { ImageService } from '../../shared/services/image.service';

const imageService = new ImageService();

// --- WatchlistProduct types ---

export interface AdminProductShopFind {
  shopId: string;
  shopName: string;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  timestamp: Date;
}

export interface AdminProduct {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  productTypeId?: string;
  disabled?: boolean;
  search?: { phrases?: string[]; exclude?: string[]; override?: boolean };
  price?: { max: number; min?: number };
  shopFinds: AdminProductShopFind[];
  bestPrice: number | null;
}

// --- Service ---

export class AdminProductsService {
  // -- WatchlistProducts --

  async listProducts(): Promise<AdminProduct[]> {
    const shops = loadShopInfos();
    const shopNameMap = new Map<string, string>(
      shops.map((s: ShopInfo) => [s.id, s.name]),
    );

    const products = await WatchlistProductModel.find().lean();
    const productIds = products.map((p) => p.id);

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const latestFinds = await ProductResultModel.aggregate([
      { $match: { productId: { $in: productIds }, timestamp: { $gte: hourAgo } } },
      { $sort: { shopId: 1, timestamp: -1 } },
      {
        $group: {
          _id: { productId: '$productId', shopId: '$shopId' },
          shopId: { $first: '$shopId' },
          productId: { $first: '$productId' },
          price: { $first: '$price' },
          isAvailable: { $first: '$isAvailable' },
          productUrl: { $first: '$productUrl' },
          timestamp: { $first: '$timestamp' },
        },
      },
    ]);

    const findsByProduct = new Map<string, AdminProductShopFind[]>();
    for (const find of latestFinds) {
      const finds = findsByProduct.get(find.productId) ?? [];
      finds.push({
        shopId: find.shopId,
        shopName: shopNameMap.get(find.shopId) ?? find.shopId,
        price: find.price,
        isAvailable: find.isAvailable,
        productUrl: find.productUrl,
        timestamp: find.timestamp,
      });
      findsByProduct.set(find.productId, finds);
    }

    const result: AdminProduct[] = products.map((p) => {
      const shopFinds = findsByProduct.get(p.id) ?? [];
      // Sort: available with price ASC first, then unavailable
      shopFinds.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        if (a.price !== null && b.price !== null) return a.price - b.price;
        if (a.price !== null) return -1;
        if (b.price !== null) return 1;
        return 0;
      });

      const bestAvailable = shopFinds.find((f) => f.isAvailable && f.price !== null);

      return {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        productSetId: p.productSetId,
        productTypeId: p.productTypeId,
        disabled: p.disabled,
        search: p.search,
        price: p.price,
        shopFinds,
        bestPrice: bestAvailable?.price ?? null,
      };
    });

    // Sort: enabled products by best price ASC, disabled at end
    result.sort((a, b) => {
      if (a.disabled && !b.disabled) return 1;
      if (!a.disabled && b.disabled) return -1;
      if (a.bestPrice !== null && b.bestPrice !== null) return a.bestPrice - b.bestPrice;
      if (a.bestPrice !== null) return -1;
      if (b.bestPrice !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  async createProduct(data: {
    id: string;
    name: string;
    imageUrl: string;
    productSetId?: string;
    productTypeId?: string;
    search?: { phrases?: string[]; exclude?: string[]; override?: boolean };
    price?: { max: number; min?: number };
    disabled?: boolean;
  }) {
    const existing = await WatchlistProductModel.findOne({ id: data.id }).lean();
    if (existing) throw new ConflictError('Product with this ID already exists');

    const product = await WatchlistProductModel.create(data);

    if (product.imageUrl) {
      const renamed = await imageService.renameImage(product.imageUrl, 'products', data.id);
      if (renamed !== product.imageUrl) {
        product.imageUrl = renamed;
        await product.save();
      }
    }

    return product.toObject();
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    const product = await WatchlistProductModel.findOne({ id });
    if (!product) throw new NotFoundError('Product not found');

    Object.assign(product, data);
    await product.save();
    return product.toObject();
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await WatchlistProductModel.findOne({ id });
    if (!product) throw new NotFoundError('Product not found');

    if (product.imageUrl) {
      await imageService.deleteImage(product.imageUrl);
    }

    await Promise.all([
      WatchlistProductModel.deleteOne({ id }),
      UserWatchEntryModel.deleteMany({ productId: id }),
      NotificationStateModel.deleteMany({ productId: id }),
      NotificationModel.deleteMany({ 'payload.productId': id }),
      ProductResultModel.deleteMany({ productId: id }),
    ]);
  }

  async uploadProductImage(id: string, buffer: Buffer): Promise<string> {
    const product = await WatchlistProductModel.findOne({ id });
    if (!product) throw new NotFoundError('Product not found');

    if (product.imageUrl) {
      await imageService.deleteImage(product.imageUrl);
    }

    const imageUrl = await imageService.validateAndUpload(buffer, 'products', {
      publicId: id,
    });
    product.imageUrl = imageUrl;
    await product.save();
    return imageUrl;
  }

  async uploadImageOnly(buffer: Buffer): Promise<string> {
    return imageService.validateAndUpload(buffer, 'products');
  }

  // -- ProductSets --

  async listSets() {
    return ProductSetModel.find().sort({ releaseDate: -1 }).lean();
  }

  async createSet(data: {
    id: string;
    name: string;
    series: string;
    imageUrl?: string;
    releaseDate?: string;
  }) {
    const existing = await ProductSetModel.findOne({ id: data.id }).lean();
    if (existing) throw new ConflictError('Product set with this ID already exists');

    const set = await ProductSetModel.create({
      ...data,
      imageUrl: data.imageUrl ?? '',
      releaseDate: data.releaseDate ? new Date(data.releaseDate) : undefined,
    });

    if (set.imageUrl) {
      const renamed = await imageService.renameImage(set.imageUrl, 'product-sets', data.id);
      if (renamed !== set.imageUrl) {
        set.imageUrl = renamed;
        await set.save();
      }
    }

    return set.toObject();
  }

  async updateSet(id: string, data: Record<string, unknown>) {
    const set = await ProductSetModel.findOne({ id });
    if (!set) throw new NotFoundError('Product set not found');

    if (typeof data.releaseDate === 'string') {
      data.releaseDate = new Date(data.releaseDate);
    }
    Object.assign(set, data);
    await set.save();
    return set.toObject();
  }

  async deleteSet(id: string): Promise<void> {
    const refCount = await WatchlistProductModel.countDocuments({ productSetId: id });
    if (refCount > 0) {
      throw new ConflictError(
        `Cannot delete: ${refCount} product(s) reference this set`,
      );
    }
    const set = await ProductSetModel.findOne({ id });
    if (!set) throw new NotFoundError('Product set not found');

    if (set.imageUrl) {
      await imageService.deleteImage(set.imageUrl);
    }

    await ProductSetModel.deleteOne({ id });
  }

  async uploadSetImage(id: string, buffer: Buffer): Promise<string> {
    const set = await ProductSetModel.findOne({ id });
    if (!set) throw new NotFoundError('Product set not found');

    if (set.imageUrl) {
      await imageService.deleteImage(set.imageUrl);
    }

    const imageUrl = await imageService.validateAndUpload(buffer, 'product-sets', {
      publicId: id,
      requireSquare: false,
    });
    set.imageUrl = imageUrl;
    await set.save();
    return imageUrl;
  }

  // -- ProductTypes --

  async listTypes() {
    return ProductTypeModel.find().sort({ name: 1 }).lean();
  }

  async createType(data: {
    id: string;
    name: string;
    search?: { phrases?: string[]; exclude?: string[] };
  }) {
    const existing = await ProductTypeModel.findOne({ id: data.id }).lean();
    if (existing) throw new ConflictError('Product type with this ID already exists');

    const type = await ProductTypeModel.create(data);
    return type.toObject();
  }

  async updateType(id: string, data: Record<string, unknown>) {
    const type = await ProductTypeModel.findOne({ id });
    if (!type) throw new NotFoundError('Product type not found');

    Object.assign(type, data);
    await type.save();
    return type.toObject();
  }

  async deleteType(id: string): Promise<void> {
    const refCount = await WatchlistProductModel.countDocuments({ productTypeId: id });
    if (refCount > 0) {
      throw new ConflictError(
        `Cannot delete: ${refCount} product(s) reference this type`,
      );
    }
    const result = await ProductTypeModel.deleteOne({ id });
    if (result.deletedCount === 0) throw new NotFoundError('Product type not found');
  }
}
