/**
 * Default scraper implementation using configuration-only approach.
 */

import { ShopConfig, WatchlistProductInternal, ProductResult } from '../../shared/types';
import { IEngine } from '../engines/engine.interface';
import { BaseScraper, IScraperLogger } from './base/base-scraper';

/**
 * Default scraper that uses shop configuration for all scraping logic.
 * No custom overrides - pure configuration-driven implementation.
 */
export class DefaultScraper extends BaseScraper {
  constructor(config: ShopConfig, engine: IEngine, logger?: IScraperLogger) {
    super(config, engine, logger);
  }
}
