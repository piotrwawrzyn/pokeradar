import { Browser } from 'playwright';
import { ScrapingEngine } from '../types';
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
 * @returns An engine implementing IEngine
 */
export function createEngine(type: ScrapingEngine, browser?: Browser): IEngine {
  switch (type) {
    case 'playwright':
      return new PlaywrightEngine(browser);
    case 'cheerio':
    default:
      return new CheerioEngine();
  }
}
