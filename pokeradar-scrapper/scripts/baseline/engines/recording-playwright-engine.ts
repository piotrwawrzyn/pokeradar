/**
 * RecordingPlaywrightEngine - IEngine implementation that records rendered HTML from Playwright.
 *
 * Purpose:
 * - Performs real browser automation using Playwright (same as production PlaywrightEngine)
 * - After each page load, captures the fully rendered HTML (post-JavaScript)
 * - Saves rendered HTML to fixture files for later replay with Cheerio
 * - Used during baseline recording for Playwright-based shops
 *
 * Key insight: Even though this uses Playwright during recording, the saved HTML
 * is static and can be replayed with ReplayEngine (Cheerio-based) for speed.
 *
 * This is a standalone implementation to avoid modifying production code.
 */

import { Browser, Page, Locator, BrowserContext } from 'playwright';
import { Selector, ExtractType } from '../../../src/shared/types';
import { IEngine, IElement } from '../../../src/scraper/engines/engine.interface';
import { PlaywrightElement } from '../../../src/scraper/engines/element/playwright-element';
import { safeClose } from '../../../src/shared/utils/safe-close';
import { FixtureStore } from './fixture-store';

/**
 * Logger interface for engine operations.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Domains to block for performance optimization (same as production).
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
 * Playwright-based scraping engine with HTML recording capability.
 */
export class RecordingPlaywrightEngine implements IEngine {
  private page: Page | null = null;
  private context: BrowserContext | null = null;
  private ownsBrowser: boolean = false;
  private browser: Browser | null = null;

  private readonly NAVIGATION_TIMEOUT = 15000;
  private readonly ACTION_TIMEOUT = 5000;

  constructor(
    private existingBrowser: Browser | undefined,
    private fixtureStore: FixtureStore,
    private shopId: string,
    private logger?: ILogger
  ) {}

  /**
   * Navigates to a URL, waits for rendering, saves HTML to fixtures.
   */
  async goto(url: string): Promise<void> {
    if (!this.page) {
      await this.initializePage();
    }

    // Navigate and wait for network idle (JavaScript rendering complete)
    await this.page!.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.NAVIGATION_TIMEOUT,
    });

    // Short wait for dynamic content to settle
    await this.page!.waitForTimeout(500);

    // Capture fully rendered HTML
    const html = await this.page!.content();
    const finalUrl = this.page!.url();

    // Save to fixture under BOTH the original URL and final URL (after redirects)
    // This handles cases where baseline stores original URL but fixture is under final URL
    this.fixtureStore.saveHtml(this.shopId, url, html);
    if (finalUrl !== url) {
      this.fixtureStore.saveHtml(this.shopId, finalUrl, html);
    }
  }

  getCurrentUrl(): string | null {
    return this.page?.url() || null;
  }

  /**
   * Extracts a single value using the selector.
   * Supports fallback selectors.
   */
  async extract(selector: Selector): Promise<string | null> {
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);
        const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

        if (count === 0) {
          continue;
        }

        const value = await this.extractValue(locator.first(), selector.extract || 'text');
        if (value) {
          return value;
        }
      } catch (error) {
        this.logger?.debug('RecordingPlaywrightEngine.extract failed', {
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
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);
        const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

        if (count === 0) {
          continue;
        }

        const elements: IElement[] = [];
        for (let i = 0; i < count; i++) {
          elements.push(new PlaywrightElement(locator.nth(i), this.logger));
        }
        return elements;
      } catch (error) {
        this.logger?.debug('RecordingPlaywrightEngine.extractAll failed', {
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
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);
        const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

        if (count > 0) {
          return true;
        }
      } catch (error) {
        this.logger?.debug('RecordingPlaywrightEngine.exists failed', {
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

  /**
   * Initializes Playwright page with resource blocking.
   */
  private async initializePage(): Promise<void> {
    if (this.existingBrowser) {
      if (!this.existingBrowser.isConnected()) {
        throw new Error('Shared browser is already closed');
      }

      this.context = await this.existingBrowser.newContext();
      this.page = await this.context.newPage();
      this.ownsBrowser = false;
    } else {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-sandbox',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
        ],
      });
      this.page = await this.browser.newPage();
      this.ownsBrowser = true;
    }

    this.page.setDefaultTimeout(this.ACTION_TIMEOUT);
    this.page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

    await this.setupResourceBlocking();
  }

  /**
   * Sets up resource blocking for performance (same as production).
   */
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

  /**
   * Creates a Playwright locator for the given selector type.
   */
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

  /**
   * Extracts value from locator based on extraction type.
   */
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
      this.logger?.debug('RecordingPlaywrightEngine.extractValue failed', {
        extractType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
