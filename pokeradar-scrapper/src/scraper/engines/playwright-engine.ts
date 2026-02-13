/**
 * Playwright-based engine with full browser automation.
 * Supports JavaScript rendering and complex interactions.
 */

import { Browser, Page, Locator, BrowserContext, chromium } from 'playwright';
import { Selector, ExtractType, ShopConfig } from '../../shared/types';
import { getProxyConfig, ProxyConfig } from '../../shared/utils';
import { IEngine, IElement } from './engine.interface';
import { PlaywrightElement } from './element/playwright-element';
import { safeClose } from '../../shared/utils/safe-close';

/**
 * Logger interface for engine operations.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Domains to block for performance optimization.
 */
const BLOCKED_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'doubleclick.net',
  'hotjar.com',
  'clarity.ms',
  'crisp.chat',
  'tawk.to',
  'intercom.io',
  'zendesk.com',
  'livechatinc.com',
];

/**
 * Playwright-based scraping engine.
 */
export class PlaywrightEngine implements IEngine {
  private page: Page | null = null;
  private context: BrowserContext | null = null;
  private ownsBrowser: boolean = false;
  private browser: Browser | null = null;
  private proxyConfig: ProxyConfig | null = null;

  private readonly NAVIGATION_TIMEOUT = 10000;  // Reduced from 15s to 10s
  private readonly ACTION_TIMEOUT = 500;  // Reduced from 1000ms to 500ms

  constructor(
    private shop: ShopConfig,
    private existingBrowser?: Browser,
    private logger?: ILogger
  ) {
    this.proxyConfig = getProxyConfig(shop);
  }

  async goto(url: string): Promise<void> {
    if (!this.page) {
      await this.initializePage();
    }

    // Apply jittered delay if configured
    await this.applyJitteredDelay();

    // Retry with exponential backoff (up to 3 attempts)
    await this.retryWithBackoff(async () => {
      await this.page!.goto(url, {
        waitUntil: 'networkidle',  // Even faster than domcontentloaded - just wait for navigation to commit
        timeout: this.NAVIGATION_TIMEOUT,
      });
    });

    // Short wait for dynamic content to settle
    await this.page!.waitForTimeout(100);

    // Handle JS anti-bot challenge pages (e.g. "One moment, please..." with timed reload)
    await this.waitForChallengeIfNeeded();
  }

  /**
   * Detect and wait through JS anti-bot challenge pages that reload after a delay.
   */
  private async waitForChallengeIfNeeded(): Promise<void> {
    const CHALLENGE_TITLES = ['one moment, please', 'just a moment'];
    const title = (await this.page!.title()).toLowerCase();

    if (!CHALLENGE_TITLES.some((t) => title.includes(t))) {
      return;
    }

    this.logger?.debug('Challenge page detected, waiting for reload', {
      shop: this.shop.id,
      title,
    });

    // Wait for the challenge reload to complete (typically 5-10s)
    await this.page!.waitForEvent('load', { timeout: 15000 });
    await this.page!.waitForLoadState('networkidle');
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

        if (attempt === maxAttempts) {
          throw error;
        }

        // Exponential backoff: 2s, 5s
        const waitMs = attempt === 1 ? 2000 : 5000;

        // Use warn level for retries - this is important operational info
        if (this.logger && 'warn' in this.logger) {
          (this.logger as any).warn('Navigation failed, retrying with backoff', {
            shop: this.shop.id,
            attempt,
            maxAttempts,
            waitMs,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    throw lastError;
  }

  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  async extract(selector: Selector): Promise<string | null> {
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);

        // Use all() which returns immediately
        const elements = await locator.all();

        if (elements.length === 0) {
          continue;
        }

        const value = await this.extractValue(locator.first(), selector.extract || 'text');
        if (value) {
          return value;
        }
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.extract failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return null;
  }

  async extractAll(selector: Selector): Promise<IElement[]> {
    const startTime = Date.now();
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value)
      ? selector.value
      : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const countStart = Date.now();
        const locator = this.createLocator(selector.type, selectorValue);

        // Use all() which returns immediately without waiting
        const rawElements = await locator.all();

        const countTime = Date.now() - countStart;

        if (rawElements.length === 0) continue;

        const elements: IElement[] = Array.from(
          { length: rawElements.length },
          (_, i) => new PlaywrightElement(locator.nth(i), this.logger)
        );

        return elements;
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return [];
  }

  async exists(selector: Selector): Promise<boolean> {
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);

        // Use all() which returns immediately
        const elements = await locator.all();

        if (elements.length > 0) {
          return true;
        }
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.exists failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return false;
  }

  async close(): Promise<void> {
    if (this.page) {
      await safeClose(this.page);
      this.page = null;
    }
  
    if (this.context) {
      await safeClose(this.context);
      this.context = null;
    }
  
    if (this.ownsBrowser && this.browser) {
      await safeClose(this.browser);
      this.browser = null;
    }
  }

  private async initializePage(): Promise<void> {
    const proxyOption = this.proxyConfig ? {
      proxy: {
        server: `http://${this.proxyConfig.host}:${this.proxyConfig.port}`,
        username: this.proxyConfig.username,
        password: this.proxyConfig.password,
      },
    } : {};

    // When proxy is needed, always launch a dedicated browser instance.
    // Chromium doesn't support per-context proxy unless the browser was launched with proxy.
    if (this.existingBrowser && !this.proxyConfig) {
      if (!this.existingBrowser.isConnected()) {
        throw new Error('Shared browser is already closed');
      }

      this.context = await this.existingBrowser.newContext();
      this.page = await this.context.newPage();
      this.ownsBrowser = false;
    } else {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
        ...proxyOption,
      });
      this.page = await this.browser.newPage();
      this.ownsBrowser = true;
    }

    this.page.setDefaultTimeout(this.ACTION_TIMEOUT);
    this.page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

    await this.setupResourceBlocking();
  }

  private async setupResourceBlocking(): Promise<void> {
    await this.page!.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();

      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
        return;
      }

      if (BLOCKED_DOMAINS.some((domain) => url.includes(domain))) {
        route.abort();
        return;
      }

      route.continue();
    });
  }

  private createLocator(type: string, value: string): Locator {
    if (!this.page) {
      throw new Error('No page loaded.');
    }

    switch (type) {
      case 'css':
        return this.page.locator(value);
      case 'xpath':
        return this.page.locator(`xpath=${value}`);
      case 'text':
        return this.page.locator(`text=${value}`);
      default:
        throw new Error(`Unknown selector type: ${type}`);
    }
  }

  private async extractValue(locator: Locator, extractType: ExtractType): Promise<string | null> {
    try {
      switch (extractType) {
        case 'href':
          return await locator.getAttribute('href');
        case 'text':
          const text = await locator.textContent();
          return text?.trim() || null;
        case 'innerHTML':
          return await locator.innerHTML();
        default:
          const defaultText = await locator.textContent();
          return defaultText?.trim() || null;
      }
    } catch (error) {
      this.logger?.debug('PlaywrightEngine.extractValue failed', {
        extractType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
