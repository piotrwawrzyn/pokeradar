import type { Product, ProductSet, WatchlistEntry, UserProfile, TelegramLinkToken } from '@/types';

export const mockProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'Pikachu VMAX',
    imageUrl: 'https://example.com/pikachu.jpg',
    productSetId: 'set-1',
    disabled: false,
    currentBestPrice: 179.99,
    currentBestShop: 'shop-a',
    currentBestUrl: 'https://shop-a.com/pikachu',
  },
  {
    id: 'prod-2',
    name: 'Charizard EX',
    imageUrl: 'https://example.com/charizard.jpg',
    productSetId: 'set-1',
    disabled: false,
    currentBestPrice: 249.99,
    currentBestShop: 'shop-b',
    currentBestUrl: 'https://shop-b.com/charizard',
  },
  {
    id: 'prod-3',
    name: 'Mewtwo GX',
    imageUrl: 'https://example.com/mewtwo.jpg',
    productSetId: 'set-2',
    disabled: false,
    currentBestPrice: null,
    currentBestShop: null,
    currentBestUrl: null,
  },
  {
    id: 'prod-4',
    name: 'Eevee Promo',
    imageUrl: 'https://example.com/eevee.jpg',
    disabled: false,
    currentBestPrice: 29.99,
    currentBestShop: 'shop-a',
    currentBestUrl: 'https://shop-a.com/eevee',
  },
  {
    id: 'prod-5',
    name: 'Retired Booster',
    imageUrl: 'https://example.com/retired.jpg',
    productSetId: 'set-2',
    disabled: true,
    currentBestPrice: 99.99,
    currentBestShop: 'shop-c',
    currentBestUrl: 'https://shop-c.com/retired',
  },
];

export const mockProductSets: ProductSet[] = [
  {
    id: 'set-1',
    name: 'Scarlet & Violet',
    series: 'Scarlet & Violet',
    imageUrl: 'https://example.com/sv.jpg',
    releaseDate: '2024-01-15',
  },
  {
    id: 'set-2',
    name: 'Sword & Shield',
    series: 'Sword & Shield',
    imageUrl: 'https://example.com/swsh.jpg',
    releaseDate: '2023-06-01',
  },
];

export const mockWatchlist: WatchlistEntry[] = [
  {
    id: 'watch-1',
    productId: 'prod-1',
    maxPrice: 150,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

export const mockUser: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  telegramLinked: true,
  telegramLinkToken: 'abc123token',
};

export const mockUserNoTelegram: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  telegramLinked: false,
  telegramLinkToken: null,
};

export const mockTelegramToken: TelegramLinkToken = {
  telegramLinkToken: 'abc123token',
};
