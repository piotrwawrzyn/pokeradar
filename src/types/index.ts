// Selector types
export type SelectorType = 'css' | 'xpath' | 'text';
export type PriceFormat = 'european' | 'us';
export type ExtractType = 'href' | 'text' | 'innerHTML';

export interface Selector {
  type: SelectorType;
  value: string | string[];  // Array for fallback selectors
  extract?: ExtractType;
  format?: PriceFormat;
  matchText?: string;
}

// Shop configuration
export interface ShopConfig {
  id: string;
  name: string;
  baseUrl: string;
  searchUrl: string;
  selectors: {
    searchPage: {
      article: Selector;
      productUrl: Selector;
    };
    productPage: {
      title: Selector;
      price: Selector;
      available: Selector | Selector[];  // Can be single or array for multiple availability checks
    };
  };
  customScraper?: string;  // Optional: path to custom scraper class
}

// Product to monitor
export interface WatchlistProduct {
  id: string;
  name?: string;  // Optional: defaults to first search phrase
  searchPhrases: string[];
  maxPrice: number;
}

export interface Watchlist {
  products: WatchlistProduct[];
}

// Scraping result
export interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  productTitle?: string;  // Actual title from the shop
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}

// Notification state
export interface NotificationState {
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
}
