/**
 * Lightweight HTTP + Cheerio based engine.
 * Uses axios to fetch HTML and Cheerio to parse it.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Selector, ExtractType, ShopConfig } from '../../shared/types';
import { getProxyConfig } from '../../shared/utils';
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
 * Current User-Agent pool (Chrome 131, latest as of Jan 2025).
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

/**
 * Pick a random User-Agent from the pool.
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Default HTTP headers for requests (User-Agent is set per instance).
 */
const DEFAULT_HEADERS = {
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
  private userAgent: string;
  private headers: Record<string, string>;
  private proxyAgent: HttpsProxyAgent<string> | null = null;

  constructor(private shop: ShopConfig, private logger?: ILogger) {
    // Pick a random User-Agent per engine instance
    this.userAgent = getRandomUserAgent();
    this.headers = {
      ...DEFAULT_HEADERS,
      'User-Agent': this.userAgent,
    };

    // Configure proxy if enabled globally and for this shop
    const proxyConfig = getProxyConfig(shop);
    if (proxyConfig) {
      this.proxyAgent = new HttpsProxyAgent(proxyConfig.url);
      this.logger?.debug('Proxy enabled', { shop: shop.id });
    } else if (shop.antiBot?.useProxy) {
      this.logger?.debug('Shop has useProxy=true but proxy is disabled globally', { shop: shop.id });
    }
  }

  async goto(url: string): Promise<void> {
    this.$ = null;

    // Apply jittered delay if configured
    await this.applyJitteredDelay();

    // Retry with exponential backoff (up to 3 attempts)
    const response = await this.retryWithBackoff(async () => {
      return await axios.get<string>(url, {
        headers: this.headers,
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
        ...(this.proxyAgent && {
          httpAgent: this.proxyAgent,
          httpsAgent: this.proxyAgent,
          proxy: false,
        }),
      });
    });

    this.$ = cheerio.load(response.data);
    this.currentUrl = response.request?.res?.responseUrl || url;
  }

  /**
   * Apply jittered delay before request if configured.
   */
  private async applyJitteredDelay(): Promise<void> {
    const baseDelay = this.shop.antiBot?.requestDelayMs ?? 0;
    if (baseDelay > 0) {
      const jitter = baseDelay * 0.3; // ±30% jitter
      const delay = baseDelay + (Math.random() * 2 - 1) * jitter;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Retry a request with exponential backoff.
   * Attempt 1: immediate
   * Attempt 2: wait 2s
   * Attempt 3: wait 5s
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    // Read from env var, default to 1 retry (2 total attempts)
    const maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS || '1', 10);
    const maxAttempts = 1 + maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxAttempts) {
          throw error;
        }

        // Exponential backoff: 2s, 5s
        const waitMs = attempt === 1 ? 2000 : 5000;

        // Use warn level for retries - this is important operational info
        if (this.logger && 'warn' in this.logger) {
          (this.logger as any).warn('Request failed, retrying with backoff', {
            shop: this.shop.id,
            attempt,
            maxAttempts,
            waitMs,
            retryable: true,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable (network error, 5xx, 429, 403).
   */
  private isRetryableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Network errors (no response)
    if (!error.response) {
      return true;
    }

    // Retryable status codes
    const status = error.response.status;
    return status === 403 || status === 429 || (status >= 500 && status < 600);
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
