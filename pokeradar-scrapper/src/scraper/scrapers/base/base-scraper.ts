/**
 * Base scraper class implementing the template method pattern.
 * Provides default implementation for most shops, with hooks for customization.
 * Engine-agnostic - works with both Cheerio and Playwright engines.
 */

import { ShopConfig, WatchlistProductInternal, ProductResult } from '../../../shared/types';
import { IEngine } from '../../engines/engine.interface';
import { PriceParser } from '../../../shared/utils/price-parser';
import { ProductMatcher } from './product-matcher';
import { SearchNavigator, SearchResult } from './search-navigator';

/**
 * Logger interface for scraper operations.
 */
export interface IScraperLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Scraper interface for dependency injection.
 */
export interface IScraper {
  scrapeProduct(product: WatchlistProductInternal): Promise<ProductResult | null>;
  scrapeProductWithUrl(
    product: WatchlistProductInternal,
    productUrl: string,
  ): Promise<ProductResult | null>;
  createResultFromSearchData(
    product: WatchlistProductInternal,
    productUrl: string,
    searchPageData: { price: number | null; isAvailable: boolean },
  ): ProductResult;
  getNavigator(): SearchNavigator;
  close(): Promise<void>;
}

/**
 * Abstract base scraper with template method pattern.
 */
export abstract class BaseScraper implements IScraper {
  protected priceParser: PriceParser;
  protected matcher: ProductMatcher;
  protected navigator: SearchNavigator;

  constructor(
    protected config: ShopConfig,
    protected engine: IEngine,
    protected logger?: IScraperLogger,
  ) {
    this.priceParser = new PriceParser();
    this.matcher = new ProductMatcher(logger);
    this.navigator = new SearchNavigator(config, engine, this.matcher, logger);
  }

  /**
   * Main template method that orchestrates the scraping process.
   */
  async scrapeProduct(product: WatchlistProductInternal): Promise<ProductResult | null> {
    try {
      // Step 1: Search for product and get its URL
      const searchResult = await this.findProductUrl(product);

      if (!searchResult) {
        this.logger?.info('Product not found in search', {
          shop: this.config.id,
          product: product.id,
        });
        return null;
      }

      const { url: productUrl, isDirectHit, searchPageData } = searchResult;

      // If search page data is available, use it directly (skip product page visit)
      if (searchPageData) {
        return this.createResultFromSearchData(product, productUrl, searchPageData);
      }

      // Step 2: Navigate to product page (skip if direct hit - already there)
      if (!isDirectHit) {
        await this.navigateToProductPage(productUrl);
      }

      // Step 3: Extract price and availability from product page
      const price = await this.extractPrice();
      const isAvailable = await this.checkAvailability();

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
        price,
        isAvailable,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger?.error('Error scraping product', {
        shop: this.config.id,
        product: product.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Searches for the product and returns its URL.
   * Can be overridden by custom scrapers.
   */
  protected async findProductUrl(product: WatchlistProductInternal): Promise<SearchResult | null> {
    return this.navigator.findProductUrl(product);
  }

  /**
   * Navigates to the product page.
   * Can be overridden for custom navigation logic.
   */
  protected async navigateToProductPage(productUrl: string): Promise<void> {
    await this.navigator.navigateToProductPage(productUrl);
  }

  /**
   * Extracts the price from the product page.
   * Can be overridden for custom price extraction logic.
   */
  protected async extractPrice(): Promise<number | null> {
    const priceText = await this.engine.extract(this.config.selectors.productPage.price);

    if (!priceText) {
      return null;
    }

    const format = this.config.selectors.productPage.price.format || 'european';

    try {
      return this.priceParser.parse(priceText, format);
    } catch (error) {
      this.logger?.error('Price parsing failed', {
        shop: this.config.id,
        priceText,
        format,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Checks if the product is available.
   * Can be overridden for custom availability logic.
   */
  protected async checkAvailability(): Promise<boolean> {
    const availSelector = this.config.selectors.productPage.available;

    // Handle both single selector and array of selectors
    const selectors = Array.isArray(availSelector) ? availSelector : [availSelector];

    // Try each availability selector - presence of matching element means available
    for (const selector of selectors) {
      const exists = await this.engine.exists(selector);

      if (exists) {
        return true;
      }
    }

    this.logger?.debug('Availability check: no match found', {
      shop: this.config.id,
    });

    return false;
  }

  /**
   * Scrapes a product using a pre-resolved product page URL.
   * Skips the search phase — used when set-based search already found the URL.
   */
  async scrapeProductWithUrl(
    product: WatchlistProductInternal,
    productUrl: string,
  ): Promise<ProductResult | null> {
    try {
      await this.navigateToProductPage(productUrl);
      const price = await this.extractPrice();
      const isAvailable = await this.checkAvailability();

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
        price,
        isAvailable,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger?.error('Error scraping product with pre-resolved URL', {
        shop: this.config.id,
        product: product.id,
        url: productUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Creates a ProductResult directly from search page data, bypassing product page visit.
   * Synchronous method - no HTTP requests.
   */
  createResultFromSearchData(
    product: WatchlistProductInternal,
    productUrl: string,
    searchPageData: { price: number | null; isAvailable: boolean },
  ): ProductResult {
    this.logger?.debug('Using search page data (skipping product page visit)', {
      shop: this.config.id,
      product: product.id,
      price: searchPageData.price,
      available: searchPageData.isAvailable,
      url: productUrl,
    });

    return {
      productId: product.id,
      shopId: this.config.id,
      productUrl,
      price: searchPageData.price,
      isAvailable: searchPageData.isAvailable,
      timestamp: new Date(),
    };
  }

  /**
   * Exposes the navigator for set-based search operations.
   */
  getNavigator(): SearchNavigator {
    return this.navigator;
  }

  /**
   * Closes the underlying engine and releases resources.
   */
  async close(): Promise<void> {
    await this.engine.close();
  }
}
