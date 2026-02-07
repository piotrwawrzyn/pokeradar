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

import { Browser, Page, Locator, BrowserContext } from 'patchright';
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
  /**
   * WORKAROUND: Extract ALL elements in DOM order by bypassing Playwright's locator.nth().
   *
   * Problem:
   * --------
   * Playwright's locator.nth(i) does NOT preserve DOM order, despite what the documentation
   * suggests. When extracting multiple elements with the same selector, nth() returns them
   * in an unpredictable order that differs from document.querySelectorAll().
   *
   * This causes non-deterministic behavior when comparing with Cheerio, which correctly
   * returns elements in DOM order. The same HTML produces different element orders:
   * - Playwright nth(): [25086, 25082, 25080, 25084, 25087, 25088, ...]
   * - Cheerio (DOM):    [25086, 25082, 25083, 25089, 25085, 25218, ...]
   *
   * How this workaround works:
   * -------------------------
   * 1. Use page.evaluate() with document.querySelectorAll() to get ALL elements in order
   *    (querySelectorAll() is guaranteed by DOM spec to return elements in document order)
   * 2. Assign temporary unique data attributes (data-pw-dom-index="0", "1", etc.) to each element
   * 3. Create Playwright locators by filtering for each specific data attribute
   * 4. Clean up temporary attributes after creating locators
   * 5. This ensures locators are created in exact DOM order, regardless of content
   *
   * Why temporary attributes instead of text/href:
   * ----------------------------------------------
   * - Text content might not be unique (e.g., multiple "Product A" items)
   * - Not all elements have hrefs
   * - Temporary attributes guarantee uniqueness for any element
   *
   * Why not just use querySelectorAll():
   * ------------------------------------
   * We need Playwright Locators (not ElementHandles) because PlaywrightElement expects them.
   * Converting ElementHandle → Locator is not straightforward in Playwright's API.
   *
   * Limitation:
   * -----------
   * Only works with CSS selectors. XPath and text selectors cannot be used with
   * querySelectorAll(), so they fall back to extractAllWithNth() which does NOT
   * guarantee DOM order.
   *
   * @param selector - The CSS selector to query
   * @returns Array of PlaywrightElements in DOM order (CSS selectors only)
   */
  private async extractAllInDomOrder(selector: string): Promise<IElement[]> {
    // Assign temporary unique IDs to preserve DOM order
    const count = await this.page!.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      elements.forEach((el, index) => {
        (el as HTMLElement).setAttribute('data-pw-dom-index', String(index));
      });
      return elements.length;
    }, selector);

    if (count === 0) {
      return [];
    }

    // Create locators using the temporary unique IDs
    const baseLocator = this.page!.locator(selector);
    const elements: IElement[] = [];

    for (let i = 0; i < count; i++) {
      const locator = baseLocator.filter({
        has: this.page!.locator(`[data-pw-dom-index="${i}"]`)
      });
      elements.push(new PlaywrightElement(locator.first(), this.logger));
    }

    // Clean up temporary attributes
    await this.page!.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      elements.forEach(el => {
        (el as HTMLElement).removeAttribute('data-pw-dom-index');
      });
    }, selector);

    return elements;
  }

  async extractAll(selector: Selector): Promise<IElement[]> {
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const elements = selector.type === 'css'
          ? await this.extractAllInDomOrder(selectorValue)
          : await this.extractAllWithNth(selector.type, selectorValue);

        if (elements.length > 0) {
          return elements;
        }
      } catch (error) {
        this.logger?.debug('RecordingPlaywrightEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return [];
  }

  /**
   * Fallback for non-CSS selectors (xpath, text).
   *
   * ⚠️ WARNING: Does NOT preserve DOM order! ⚠️
   * -------------------------------------------
   * This method uses Playwright's locator.nth(i) which does NOT return elements
   * in DOM order. This is a known Playwright bug that affects xpath and text selectors.
   *
   * For deterministic baseline testing, prefer CSS selectors which use extractAllInDomOrder().
   *
   * Why not fix this:
   * - document.querySelectorAll() only works with CSS selectors
   * - Converting xpath/text to CSS at runtime is complex and error-prone
   * - Most selectors in shop configs are CSS-based
   *
   * @param type - Selector type (xpath or text)
   * @param value - Selector value
   * @returns Array of PlaywrightElements in UNPREDICTABLE order (non-deterministic)
   */
  private async extractAllWithNth(type: string, value: string): Promise<IElement[]> {
    const locator = this.createLocator(type, value);
    const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

    if (count === 0) {
      return [];
    }

    return Array.from({ length: count }, (_, i) =>
      new PlaywrightElement(locator.nth(i), this.logger)
    );
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
      const { chromium } = await import('patchright');
      this.browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
      this.context = await this.browser.newContext({
        viewport: null,
      });
      this.page = await this.context.newPage();
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
