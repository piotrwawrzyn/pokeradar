import { Browser } from 'playwright';
import { ScrapingEngine } from '../types';
import { Logger } from '../services/Logger';
import { IEngine, IElement } from './IEngine';
import { CheerioEngine } from './CheerioEngine';
import { PlaywrightEngine } from './PlaywrightEngine';

export { IEngine, IElement } from './IEngine';
export { CheerioEngine } from './CheerioEngine';
export { PlaywrightEngine } from './PlaywrightEngine';

/**
 * Creates an engine instance based on the specified type.
 *
 * @param type - The engine type ('cheerio' or 'playwright')
 * @param browser - Optional existing Playwright browser for reuse
 * @param logger - Optional logger for error reporting
 * @returns An engine implementing IEngine
 */
export function createEngine(type: ScrapingEngine, browser?: Browser, logger?: Logger): IEngine {
  switch (type) {
    case 'playwright':
      return new PlaywrightEngine(browser, logger);
    case 'cheerio':
    default:
      return new CheerioEngine(logger);
  }
}
