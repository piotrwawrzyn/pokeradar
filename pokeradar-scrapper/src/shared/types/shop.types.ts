/**
 * Shop configuration type definitions.
 */

import { Selector } from './selector.types';

export type ScrapingEngine = 'cheerio' | 'playwright';
export type FetchingTier = 'super-slow' | 'slow' | 'fast' | 'super-fast';

/**
 * Anti-bot detection configuration for shops.
 */
export interface AntiBotConfig {
  requestDelayMs?: number;  // Base delay (ms) before each request, with ±30% random jitter. Default: 0
  maxConcurrency?: number;  // Max concurrent product page requests for this shop. Default: PRODUCT_CONCURRENCY env var
  useProxy?: boolean;       // Route requests through rotating proxy. Default: false
}

export interface ShopConfig {
  id: string;
  name: string;
  disabled?: boolean; // Optional: exclude shop from scraping
  engine?: ScrapingEngine; // Optional: scraping engine (default: 'cheerio')
  fetchingTier?: FetchingTier; // Optional: speed tier for cron grouping (default: 'fast')
  antiBot?: AntiBotConfig; // Optional: anti-bot detection settings
  baseUrl: string;
  searchUrl: string; // Use {query} placeholder for search term
  directHitPattern?: string; // Optional: regex pattern to detect search redirect to product page
  selectors: {
    searchPage: {
      article: Selector;
      productUrl: Selector;
      title: Selector;
      price?: Selector;                       // Optional: price within article element
      available?: Selector | Selector[];      // Optional: any match = product is available
      unavailable?: Selector | Selector[];    // Optional: any match = product is unavailable
    };
    productPage: {
      title?: Selector; // Optional: for direct hit validation
      price: Selector;
      available: Selector | Selector[];
    };
  };
  customScraper?: string; // Optional: path to custom scraper class
}
