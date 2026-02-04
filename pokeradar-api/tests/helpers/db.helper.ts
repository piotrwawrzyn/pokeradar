import {
  WatchlistProductModel,
  ProductResultModel,
} from '../../src/infrastructure/database/models';

export async function seedProducts() {
  await WatchlistProductModel.create([
    {
      id: 'pokemon-151-booster-box',
      name: 'Pokemon 151 Booster Box',
      imageUrl: 'https://example.com/images/pokemon-151.jpg',
      search: { phrases: ['pokemon 151 booster box'], exclude: [] },
      price: { max: 200 },
    },
    {
      id: 'scarlet-violet-etb',
      name: 'Scarlet & Violet Elite Trainer Box',
      imageUrl: 'https://example.com/images/sv-etb.jpg',
      search: { phrases: ['scarlet violet etb'], exclude: [] },
      price: { max: 150 },
    },
    {
      id: 'charizard-upc',
      name: 'Charizard Ultra Premium Collection',
      imageUrl: 'https://example.com/images/charizard-upc.jpg',
      search: { phrases: ['charizard upc'], exclude: [] },
      price: { max: 500 },
    },
  ]);
}

export async function seedProductResults(productId: string) {
  const now = new Date();
  const hourBucket = now.toISOString().slice(0, 13);

  await ProductResultModel.create([
    {
      productId,
      shopId: 'shop-a',
      hourBucket,
      productUrl: 'https://shop-a.pl/product/1',
      price: 179.99,
      isAvailable: true,
      timestamp: now,
    },
    {
      productId,
      shopId: 'shop-b',
      hourBucket,
      productUrl: 'https://shop-b.pl/product/1',
      price: 199.99,
      isAvailable: true,
      timestamp: now,
    },
    {
      productId,
      shopId: 'shop-c',
      hourBucket,
      productUrl: 'https://shop-c.pl/product/1',
      price: 159.99,
      isAvailable: false,
      timestamp: now,
    },
  ]);
}
