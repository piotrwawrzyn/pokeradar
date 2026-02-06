/**
 * ReplayEngine - IEngine implementation that serves saved HTML fixtures.
 *
 * Purpose:
 * - Loads pre-recorded HTML from fixture files instead of making HTTP requests
 * - Parses HTML with Cheerio for fast, deterministic extraction
 * - Works for both Cheerio-based and Playwright-based shops (both saved as static HTML)
 * - Used during baseline checking for offline, fast regression testing
 *
 * Key benefits:
 * - No network requests = fast (seconds vs minutes)
 * - No browser automation = no Playwright overhead
 * - Deterministic = same HTML inputs every time
 * - Offline = no internet or MongoDB connection needed
 */

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
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Cheerio-based engine that replays saved HTML fixtures.
 */
export class ReplayEngine implements IEngine {
  private $: cheerio.CheerioAPI | null = null;
  private currentUrl: string | null = null;

  constructor(
    private fixtureStore: FixtureStore,
    private shopId: string,
    private logger?: ILogger
  ) {}

  /**
   * "Navigates" to a URL by loading the corresponding fixture HTML.
   * No HTTP request is made - HTML is loaded from disk.
   *
   * @throws Error if fixture doesn't exist for this URL
   */
  async goto(url: string): Promise<void> {
    this.$ = null;

    // Load saved HTML from fixture
    try {
      const html = this.fixtureStore.loadHtml(this.shopId, url);
      this.currentUrl = url;
      this.$ = cheerio.load(html);
    } catch (error) {
      // Re-throw with helpful context
      throw new Error(
        `ReplayEngine.goto failed for ${this.shopId}: ${url}\n` +
        `${error instanceof Error ? error.message : String(error)}\n` +
        `This usually means the fixture wasn't recorded. Run 'npm run baseline:record' first.`
      );
    }
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
        this.logger?.debug('ReplayEngine.extract failed', {
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
        this.logger?.debug('ReplayEngine.extractAll failed', {
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
        this.logger?.debug('ReplayEngine.exists failed', {
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
