/**
 * Shop configuration type definitions.
 */

import { Selector } from './selector.types';

export type ScrapingEngine = 'cheerio' | 'playwright';

export interface ShopConfig {
  id: string;
  name: string;
  disabled?: boolean; // Optional: exclude shop from scraping
  engine?: ScrapingEngine; // Optional: scraping engine (default: 'cheerio')
  baseUrl: string;
  searchUrl: string; // Use {query} placeholder for search term
  directHitPattern?: string; // Optional: regex pattern to detect search redirect to product page
  selectors: {
    searchPage: {
      article: Selector;
      productUrl: Selector;
      title: Selector;
    };
    productPage: {
      title?: Selector; // Optional: for direct hit validation
      price: Selector;
      available: Selector | Selector[];
    };
  };
  customScraper?: string; // Optional: path to custom scraper class
}
