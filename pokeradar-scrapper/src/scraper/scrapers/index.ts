/**
 * Scrapers module exports.
 */

export { BaseScraper, IScraper, IScraperLogger } from './base/base-scraper';
export { SearchNavigator } from './base/search-navigator';
export { type ProductCandidate, selectBestCandidate } from './base/helpers/candidate-selector';
export { DefaultScraper } from './default-scraper';
export { ScraperFactory, EngineGroups } from './scraper-factory';
