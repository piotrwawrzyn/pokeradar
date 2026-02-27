/**
 * Shop configuration and selector type definitions.
 * Canonical definition — moved from pokeradar-scrapper.
 */

export type SelectorType = 'css' | 'xpath' | 'text' | 'json-attribute';
export type PriceFormat = 'european' | 'us';
export type ExtractType = 'href' | 'text' | 'innerHTML' | 'ownText';
/** How to aggregate results across JSON array items. */
export type JsonCondition = 'some' | 'every' | 'none';

export interface Selector {
  type: SelectorType;
  value: string | string[]; // Array for fallback selectors
  extract?: ExtractType;
  format?: PriceFormat;
  matchSelf?: boolean; // If true, checks if the element itself matches instead of searching descendants

  /**
   * `json-attribute` fields — used when type is 'json-attribute'.
   *
   * Finds an element via `value` (CSS), reads `attribute`, parses it as JSON,
   * then evaluates `jsonFilter` (dot-notation path) on each item in the array.
   *
   * Match logic per item:
   *   - If `jsonExpect` is set  → strict equality (`=== jsonExpect`)
   *   - Otherwise               → JS truthiness (`Boolean(value)`)
   *
   * `condition` controls how item results are aggregated (default: 'some').
   *
   * Example — any variant in stock:
   *   { attribute: "data-product_variations", jsonFilter: "is_in_stock", condition: "some" }
   *
   * Example — any variant with a specific string status:
   *   { attribute: "data-variations", jsonFilter: "stock_status", jsonExpect: "instock", condition: "some" }
   */
  attribute?: string;
  jsonFilter?: string;
  jsonExpect?: unknown;
  condition?: JsonCondition;
}

export type ScrapingEngine = 'cheerio' | 'playwright';
export type FetchingTier = 'super-slow' | 'slow' | 'fast' | 'super-fast';

/**
 * Anti-bot detection configuration for shops.
 */
export interface AntiBotConfig {
  requestDelayMs?: number; // Base delay (ms) before each request, with ±30% random jitter. Default: 0
  maxConcurrency?: number; // Max concurrent product page requests for this shop. Default: PRODUCT_CONCURRENCY env var
  useProxy?: boolean; // Route requests through rotating proxy. Default: false
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
      title?: Selector;
      titleFromUrl?: boolean;
      price?: Selector; // Optional: price within article element
      available?: Selector | Selector[]; // Optional: any match = product is available
      unavailable?: Selector | Selector[]; // Optional: any match = product is unavailable
    };
    productPage: {
      title?: Selector; // Optional: for direct hit validation
      price: Selector;
      available: Selector | Selector[];
    };
  };
  customScraper?: string; // Optional: path to custom scraper class
}
