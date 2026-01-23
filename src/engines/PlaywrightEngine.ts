import { Browser, Page, Locator } from 'playwright';
import { Selector, ExtractType } from '../types';
import { IEngine, IElement } from './IEngine';
import { Logger } from '../services/Logger';
import { safeClose } from '../utils/safeClose';

// Use playwright-extra with stealth plugin for better bot detection evasion
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

/**
 * Element wrapper for Playwright Locators.
 */
class PlaywrightElement implements IElement {
  constructor(private locator: Locator, private logger?: Logger) {}

  async getText(): Promise<string | null> {
    try {
      const text = await this.locator.textContent();
      return text?.trim() || null;
    } catch (error) {
      this.logger?.debug('PlaywrightElement.getText failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async getAttribute(name: string): Promise<string | null> {
    try {
      return await this.locator.getAttribute(name);
    } catch (error) {
      this.logger?.debug('PlaywrightElement.getAttribute failed', {
        attribute: name,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async find(selector: Selector): Promise<IElement | null> {
    try {
      const locator = this.createLocator(selector);
      // Use evaluateAll to check existence - no waiting, no timeout risk
      const count = await locator.evaluateAll(els => els.length).catch(() => 0);

      if (count === 0) {
        return null;
      }

      return new PlaywrightElement(locator.first(), this.logger);
    } catch (error) {
      this.logger?.debug('PlaywrightElement.find failed', {
        selector: selector.value,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    try {
      const locator = this.createLocator(selector);
      // Use evaluateAll to get count - no DOM snapshot, no waiting
      const count = await locator.evaluateAll(els => els.length).catch(() => 0);

      if (count === 0) {
        return [];
      }

      // Build locators by index - avoids locator.all() DOM snapshot
      const elements: IElement[] = [];
      for (let i = 0; i < count; i++) {
        elements.push(new PlaywrightElement(locator.nth(i), this.logger));
      }
      return elements;
    } catch (error) {
      this.logger?.debug('PlaywrightElement.findAll failed', {
        selector: selector.value,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private createLocator(selector: Selector): Locator {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;

    switch (selector.type) {
      case 'css':
        return this.locator.locator(value);
      case 'xpath':
        return this.locator.locator(`xpath=${value}`);
      case 'text':
        return this.locator.locator(`text=${value}`);
      default:
        throw new Error(`Unknown selector type: ${selector.type}`);
    }
  }
}

/**
 * Playwright-based engine with full browser automation.
 * Supports JavaScript rendering and complex interactions.
 */
export class PlaywrightEngine implements IEngine {
  private page: Page | null = null;
  private ownsBrowser: boolean = false;
  private browser: Browser | null = null;

  private readonly NAVIGATION_TIMEOUT = 30000;  // 30 seconds max for page load
  private readonly ACTION_TIMEOUT = 10000;  // 10 seconds max for element actions

  constructor(private existingBrowser?: Browser, private logger?: Logger) {}

  async goto(url: string): Promise<void> {
    // Create page if not exists
    if (!this.page) {
      if (this.existingBrowser) {
        this.page = await this.existingBrowser.newPage();
        this.ownsBrowser = false;
      } else {
        // Use playwright-extra with stealth for better bot detection evasion
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
        this.ownsBrowser = true;
      }

      // Set default timeouts for all actions
      this.page.setDefaultTimeout(this.ACTION_TIMEOUT);
      this.page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

      // Block unnecessary resources to save bandwidth and CPU
      await this.page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
    }

    await this.page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.NAVIGATION_TIMEOUT
    });
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
        // Use evaluateAll to check existence - no waiting, no timeout risk
        const count = await locator.evaluateAll(els => els.length).catch(() => 0);

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
          error: error instanceof Error ? error.message : String(error)
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
        // Use evaluateAll to get count - no DOM snapshot, no waiting
        const count = await locator.evaluateAll(els => els.length).catch(() => 0);

        if (count === 0) {
          continue;
        }

        // Build locators by index - avoids locator.all() memory overhead
        const elements: IElement[] = [];
        for (let i = 0; i < count; i++) {
          elements.push(new PlaywrightElement(locator.nth(i), this.logger));
        }
        return elements;
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.extractAll failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error)
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
        // Use evaluateAll to check existence - no waiting, no timeout risk
        const count = await locator.evaluateAll(els => els.length).catch(() => 0);

        if (count > 0) {
          return true;
        }
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.exists failed', {
          selector: selectorValue,
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
    }

    return false;
  }

  async close(): Promise<void> {
    if (this.page) {
      // Remove route handlers before closing to prevent hangs
      try {
        await this.page.unroute('**/*');
      } catch (error) {
        this.logger?.debug('PlaywrightEngine.close unroute failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      await safeClose(this.page);
      this.page = null;
    }

    // Only close browser if we created it
    if (this.ownsBrowser && this.browser) {
      await safeClose(this.browser);
      this.browser = null;
    }
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
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}
