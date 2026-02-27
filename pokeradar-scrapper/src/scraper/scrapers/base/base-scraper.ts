/**
 * Base scraper class implementing the template method pattern.
 * Provides default implementation for most shops, with hooks for customization.
 * Engine-agnostic - works with both Cheerio and Playwright engines.
 */

import { ShopConfig, WatchlistProductInternal, ProductResult } from '../../../shared/types';
import { IEngine } from '../../engines/engine.interface';
import { PriceParser } from '../../../shared/utils/price-parser';
import { SearchNavigator } from './search-navigator';

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
  scrapeProductWithUrl(
    product: WatchlistProductInternal,
    productUrl: string,
    productTitle: string,
  ): Promise<ProductResult | null>;
  createResultFromSearchData(
    product: WatchlistProductInternal,
    productUrl: string,
    searchPageData: { price: number | null; isAvailable: boolean },
    productTitle: string,
  ): ProductResult;
  getNavigator(): SearchNavigator;
  close(): Promise<void>;
}

/**
 * Abstract base scraper with template method pattern.
 */
export abstract class BaseScraper implements IScraper {
  protected priceParser: PriceParser;
  protected navigator: SearchNavigator;

  constructor(
    protected config: ShopConfig,
    protected engine: IEngine,
    protected logger?: IScraperLogger,
  ) {
    this.priceParser = new PriceParser();
    this.navigator = new SearchNavigator(config, engine, logger);
  }

  /**
   * Navigates to the product page.
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
   */
  async scrapeProductWithUrl(
    product: WatchlistProductInternal,
    productUrl: string,
    productTitle: string,
  ): Promise<ProductResult | null> {
    try {
      await this.navigateToProductPage(productUrl);
      const price = await this.extractPrice();
      const isAvailable = await this.checkAvailability();

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
        productTitle,
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
   */
  createResultFromSearchData(
    product: WatchlistProductInternal,
    productUrl: string,
    searchPageData: { price: number | null; isAvailable: boolean },
    productTitle: string,
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
      productTitle,
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
