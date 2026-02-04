/**
 * Lightweight HTTP + Cheerio based engine.
 * Uses axios to fetch HTML and Cheerio to parse it.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector, ExtractType } from '../../shared/types';
import { IEngine, IElement } from './engine.interface';
import { CheerioElement } from './element/cheerio-element';
import { toCssSelector } from './selector-utils';

/**
 * Logger interface for engine operations.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default HTTP headers for requests.
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
 * Cheerio-based scraping engine.
 */
export class CheerioEngine implements IEngine {
  private $: cheerio.CheerioAPI | null = null;
  private currentUrl: string | null = null;

  constructor(private logger?: ILogger) {}

  async goto(url: string): Promise<void> {
    this.$ = null;

    const response = await axios.get<string>(url, {
      headers: DEFAULT_HEADERS,
      timeout: 30000,
      maxRedirects: 5,
      responseType: 'text',
    });

    this.$ = cheerio.load(response.data);
    this.currentUrl = response.request?.res?.responseUrl || url;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

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
        this.logger?.debug('CheerioEngine.extract failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return null;
  }

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
        this.logger?.debug('CheerioEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return [];
  }

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
        this.logger?.debug('CheerioEngine.exists failed', {
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
