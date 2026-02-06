/**
 * RecordingCheerioEngine - IEngine implementation that records HTML during live scraping.
 *
 * Purpose:
 * - Performs real HTTP requests using axios + cheerio (same as production CheerioEngine)
 * - Intercepts every page load and saves the fetched HTML to fixture files
 * - Used during baseline recording to capture shop HTML for later replay
 *
 * This is a standalone implementation (not extending CheerioEngine) to avoid
 * modifying production code. It duplicates CheerioEngine logic intentionally.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector, ExtractType } from '../../../src/shared/types';
import { IEngine, IElement } from '../../../src/scraper/engines/engine.interface';
import { CheerioElement } from '../../../src/scraper/engines/element/cheerio-element';
import { toCssSelector } from '../../../src/scraper/engines/selector-utils';
import { FixtureStore } from './fixture-store';

/**
 * Logger interface for engine operations.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default HTTP headers matching production CheerioEngine.
 */
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'close',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

/**
 * Cheerio-based scraping engine with HTML recording capability.
 */
export class RecordingCheerioEngine implements IEngine {
  private $: cheerio.CheerioAPI | null = null;
  private currentUrl: string | null = null;

  constructor(
    private fixtureStore: FixtureStore,
    private shopId: string,
    private logger?: ILogger
  ) {}

  /**
   * Navigates to a URL, fetches HTML, saves it to fixtures, and loads it with cheerio.
   */
  async goto(url: string): Promise<void> {
    this.$ = null;

    // Perform real HTTP request
    const response = await axios.get<string>(url, {
      headers: DEFAULT_HEADERS,
      timeout: 30000,
      maxRedirects: 5,
      responseType: 'text',
    });

    const html = response.data;
    this.currentUrl = response.request?.res?.responseUrl || url;

    // Save HTML to fixture under BOTH the original URL and final URL (after redirects)
    // This handles cases where baseline stores original URL but fixture is under final URL
    this.fixtureStore.saveHtml(this.shopId, url, html);
    if (this.currentUrl !== url) {
      this.fixtureStore.saveHtml(this.shopId, this.currentUrl, html);
    }

    // Load with cheerio for extraction
    this.$ = cheerio.load(html);
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  /**
   * Extracts a single value using the selector.
   * Supports fallback selectors (tries each until one succeeds).
   */
  async extract(selector: Selector): Promise<string | null> {
    if (!this.$) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const cssSelector = toCssSelector(selector.type, selectorValue);
        const element = this.$(cssSelector).first();

        if (element.length === 0) {
          continue;
        }

        const value = this.extractValue(element, selector.extract || 'text');
        if (value) {
          return value;
        }
      } catch (error) {
        this.logger?.debug('RecordingCheerioEngine.extract failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return null;
  }

  /**
   * Extracts all elements matching the selector.
   */
  async extractAll(selector: Selector): Promise<IElement[]> {
    if (!this.$) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const $ = this.$;
    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const cssSelector = toCssSelector(selector.type, selectorValue);
        const elements = $(cssSelector);

        if (elements.length === 0) {
          continue;
        }

        const result: IElement[] = [];
        elements.each((_, el) => {
          result.push(new CheerioElement($(el), $));
        });

        return result;
      } catch (error) {
        this.logger?.debug('RecordingCheerioEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return [];
  }

  /**
   * Checks if an element matching the selector exists.
   */
  async exists(selector: Selector): Promise<boolean> {
    if (!this.$) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const cssSelector = toCssSelector(selector.type, selectorValue);
        const element = this.$(cssSelector);

        if (element.length > 0) {
          return true;
        }
      } catch (error) {
        this.logger?.debug('RecordingCheerioEngine.exists failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return false;
  }

  async close(): Promise<void> {
    this.$ = null;
    this.currentUrl = null;
  }

  /**
   * Extracts value from element based on extraction type.
   */
  private extractValue(element: cheerio.Cheerio<AnyNode>, extractType: ExtractType): string | null {
    switch (extractType) {
      case 'href':
        return element.attr('href') || null;
      case 'text':
        return element.text().trim() || null;
      case 'innerHTML':
        return element.html() || null;
      default:
        return element.text().trim() || null;
    }
  }
}
