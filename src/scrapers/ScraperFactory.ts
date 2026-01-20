import { ShopConfig } from '../types';
import { BaseScraper } from './BaseScraper';
import { Logger } from '../services/Logger';

/**
 * Default scraper implementation that uses only the configuration.
 */
class DefaultScraper extends BaseScraper {
  constructor(config: ShopConfig, logger?: Logger) {
    super(config, logger);
  }
}

/**
 * Factory for creating scraper instances.
 * Supports both default scrapers and custom implementations.
 */
export class ScraperFactory {
  /**
   * Creates a scraper instance for the given shop configuration.
   * If a custom scraper is specified, it will be loaded.
   * Otherwise, a default scraper will be created.
   */
  static create(config: ShopConfig, logger?: Logger): BaseScraper {
    if (config.customScraper) {
      // Load custom scraper (future implementation)
      // For now, just use default scraper
      // const CustomScraperClass = require(config.customScraper);
      // return new CustomScraperClass(config, logger);
      throw new Error('Custom scrapers not yet implemented');
    }

    return new DefaultScraper(config, logger);
  }
}
