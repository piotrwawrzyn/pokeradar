/**
 * Playwright-based engine with full browser automation.
 * Supports JavaScript rendering and complex interactions.
 */

import { Browser, Page, Locator } from 'playwright';
import { Selector, ExtractType } from '../../shared/types';
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
  private ownsBrowser: boolean = false;
  private browser: Browser | null = null;

  private readonly NAVIGATION_TIMEOUT = 15000;
  private readonly ACTION_TIMEOUT = 5000;

  constructor(private existingBrowser?: Browser, private logger?: ILogger) {}

  async goto(url: string): Promise<void> {
    if (!this.page) {
      await this.initializePage();
    }

    await this.page!.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.NAVIGATION_TIMEOUT,
    });

    // Short wait for dynamic content to settle
    await this.page!.waitForTimeout(500);
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
        const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

        if (count === 0) {
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
        this.logger?.debug('PlaywrightEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
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
        const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

        if (count > 0) {
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
      try {
        await this.page.unroute('**/*');
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.close unroute failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await safeClose(this.page);
      this.page = null;
    }

    if (this.ownsBrowser && this.browser) {
      await safeClose(this.browser);
      this.browser = null;
    }
  }

  private async initializePage(): Promise<void> {
    if (this.existingBrowser) {
      this.page = await this.existingBrowser.newPage();
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
