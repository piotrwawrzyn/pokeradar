import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector, ExtractType } from '../types';
import { IEngine, IElement } from './IEngine';
import { Logger } from '../services/Logger';

/**
 * Element wrapper for Cheerio selections.
 */
class CheerioElement implements IElement {
  constructor(
    private element: cheerio.Cheerio<AnyNode>,
    private $: cheerio.CheerioAPI
  ) {}

  async getText(): Promise<string | null> {
    const text = this.element.text().trim();
    return text || null;
  }

  async getAttribute(name: string): Promise<string | null> {
    const attr = this.element.attr(name);
    return attr || null;
  }

  async find(selector: Selector): Promise<IElement | null> {
    const selectorValue = this.getSelectorValue(selector);
    const found = this.element.find(selectorValue);

    if (found.length === 0) {
      return null;
    }

    return new CheerioElement(found.first(), this.$);
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    const selectorValue = this.getSelectorValue(selector);
    const found = this.element.find(selectorValue);

    const elements: IElement[] = [];
    found.each((_, el) => {
      elements.push(new CheerioElement(this.$(el), this.$));
    });

    return elements;
  }

  private getSelectorValue(selector: Selector): string {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;

    // Cheerio only supports CSS selectors natively
    if (selector.type === 'text') {
      return `:contains("${value}")`;
    }

    if (selector.type === 'xpath') {
      // XPath not fully supported in Cheerio - log warning and try CSS fallback
      console.warn(`XPath selector not supported in Cheerio engine: ${value}`);
      return value; // Try as CSS anyway
    }

    return value;
  }
}

/**
 * Lightweight HTTP + Cheerio based engine.
 * Uses axios to fetch HTML and Cheerio to parse it.
 */
export class CheerioEngine implements IEngine {
  private $: cheerio.CheerioAPI | null = null;

  constructor(private logger?: Logger) {}

  private readonly defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  async goto(url: string): Promise<void> {
    const response = await axios.get(url, {
      headers: this.defaultHeaders,
      timeout: 30000,
      maxRedirects: 5,
    });

    this.$ = cheerio.load(response.data);
  }

  async extract(selector: Selector): Promise<string | null> {
    if (!this.$) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const cssSelector = this.toCssSelector(selector.type, selectorValue);
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
          error: error instanceof Error ? error.message : String(error)
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
        const cssSelector = this.toCssSelector(selector.type, selectorValue);
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
          error: error instanceof Error ? error.message : String(error)
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
        const cssSelector = this.toCssSelector(selector.type, selectorValue);
        const element = this.$(cssSelector);

        if (element.length > 0) {
          return true;
        }
      } catch (error) {
        this.logger?.debug('CheerioEngine.exists failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
    }

    return false;
  }

  async close(): Promise<void> {
    this.$ = null;
  }

  private toCssSelector(type: string, value: string): string {
    switch (type) {
      case 'css':
        return value;
      case 'text':
        return `:contains("${value}")`;
      case 'xpath':
        // XPath not supported - log warning
        console.warn(`XPath selector "${value}" not fully supported in Cheerio, attempting as CSS`);
        return value;
      default:
        throw new Error(`Unknown selector type: ${type}`);
    }
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
