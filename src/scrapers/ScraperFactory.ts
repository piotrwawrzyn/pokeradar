import { Browser } from 'playwright';
import { ShopConfig, ScrapingEngine } from '../types';
import { createEngine, IEngine } from '../engines';
import { BaseScraper } from './BaseScraper';
import { Logger } from '../services/Logger';

/**
 * Default scraper implementation that uses only the configuration.
 */
class DefaultScraper extends BaseScraper {
  constructor(config: ShopConfig, engine: IEngine, logger?: Logger) {
    super(config, engine, logger);
  }
}

/**
 * Factory for creating scraper instances.
 * Supports both default scrapers and custom implementations.
 * Creates the appropriate engine based on shop configuration.
 */
export class ScraperFactory {
  /**
   * Creates a scraper instance for the given shop configuration.
   * If a custom scraper is specified, it will be loaded.
   * Otherwise, a default scraper will be created.
   *
   * @param config - Shop configuration
   * @param logger - Optional logger instance
   * @param browser - Optional existing Playwright browser (for Playwright engine reuse)
   */
  static create(config: ShopConfig, logger?: Logger, browser?: Browser): BaseScraper {
    // Determine engine type - custom scrapers default to Playwright for backward compatibility
    const engineType: ScrapingEngine = config.customScraper
      ? 'playwright'
      : (config.engine || 'cheerio');

    // Create the engine
    const engine = createEngine(engineType, browser);

    // Create the scraper with injected engine
    if (config.customScraper) {
      switch (config.customScraper) {
        default:
          throw new Error(`Unknown custom scraper: ${config.customScraper}`);
      }
    }

    return new DefaultScraper(config, engine, logger);
  }

  /**
   * Checks if any of the provided shops require Playwright engine.
   */
  static requiresPlaywright(shops: ShopConfig[]): boolean {
    return shops.some(shop =>
      shop.engine === 'playwright' ||
      shop.customScraper !== undefined
    );
  }

  /**
   * Groups shops by their engine type.
   */
  static groupByEngine(shops: ShopConfig[]): {
    cheerio: ShopConfig[];
    playwright: ShopConfig[];
  } {
    const cheerio: ShopConfig[] = [];
    const playwright: ShopConfig[] = [];

    for (const shop of shops) {
      // Custom scrapers always use Playwright
      if (shop.customScraper || shop.engine === 'playwright') {
        playwright.push(shop);
      } else {
        cheerio.push(shop);
      }
    }

    return { cheerio, playwright };
  }
}
