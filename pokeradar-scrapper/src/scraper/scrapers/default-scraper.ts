/**
 * Default scraper implementation using configuration-only approach.
 */

import { ShopConfig } from '../../shared/types';
import { IEngine } from '../engines/engine.interface';
import { BaseScraper, IScraperLogger } from './base/base-scraper';
import { MatchEventRepository } from '../../shared/repositories/mongo/match-event.repository';
import { MLClassifierClient } from '../../shared/clients/ml-classifier-client';

/**
 * Default scraper that uses shop configuration for all scraping logic.
 * No custom overrides - pure configuration-driven implementation.
 */
export class DefaultScraper extends BaseScraper {
  constructor(
    config: ShopConfig,
    engine: IEngine,
    logger?: IScraperLogger,
    eventRepo?: MatchEventRepository,
    mlClient?: MLClassifierClient,
  ) {
    super(config, engine, logger, eventRepo, mlClient);
  }
}
