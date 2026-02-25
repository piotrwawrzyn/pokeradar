/**
 * Factory for creating scrapers with appropriate engines.
 */

import { Browser } from 'playwright';
import { ShopConfig } from '../../shared/types';
import { CheerioEngine } from '../engines/cheerio-engine';
import { PlaywrightEngine } from '../engines/playwright-engine';
import { DefaultScraper } from './default-scraper';
import { IScraper, IScraperLogger } from './base/base-scraper';
import { MatchEventRepository } from '../../shared/repositories/mongo/match-event.repository';
import { MLClassifierClient } from '../../shared/clients/ml-classifier-client';

/**
 * Groups shops by their configured engine type.
 */
export interface EngineGroups {
  cheerio: ShopConfig[];
  playwright: ShopConfig[];
}

/**
 * Factory for creating scrapers with appropriate engines.
 */
export class ScraperFactory {
  static readonly eventRepo = new MatchEventRepository();
  static readonly mlClient: MLClassifierClient | undefined = process.env.ML_SERVICE_URL
    ? new MLClassifierClient(process.env.ML_SERVICE_URL, Number(process.env.ML_THRESHOLD ?? '70'))
    : undefined;

  /**
   * Creates a scraper for the given shop configuration.
   */
  static create(shop: ShopConfig, logger?: IScraperLogger, browser?: Browser): IScraper {
    const engine =
      shop.engine === 'playwright'
        ? new PlaywrightEngine(shop, browser, logger)
        : new CheerioEngine(shop, logger);

    return new DefaultScraper(
      shop,
      engine,
      logger,
      ScraperFactory.eventRepo,
      ScraperFactory.mlClient,
    );
  }

  /**
   * Checks if a shop requires Playwright engine.
   */
  static requiresPlaywright(shop: ShopConfig): boolean {
    return shop.engine === 'playwright' || !!shop.customScraper;
  }

  /**
   * Groups shops by their engine type for optimal batch processing.
   */
  static groupByEngine(shops: ShopConfig[]): EngineGroups {
    const cheerio: ShopConfig[] = [];
    const playwright: ShopConfig[] = [];

    for (const shop of shops) {
      if (this.requiresPlaywright(shop)) {
        playwright.push(shop);
      } else {
        cheerio.push(shop);
      }
    }

    return { cheerio, playwright };
  }
}
