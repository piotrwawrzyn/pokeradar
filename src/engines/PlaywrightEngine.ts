import { Browser, Page, Locator } from 'playwright';
import { Selector, ExtractType } from '../types';
import { IEngine, IElement } from './IEngine';

/**
 * Element wrapper for Playwright Locators.
 */
class PlaywrightElement implements IElement {
  constructor(private locator: Locator) {}

  async getText(): Promise<string | null> {
    try {
      const text = await this.locator.textContent();
      return text?.trim() || null;
    } catch {
      return null;
    }
  }

  async getAttribute(name: string): Promise<string | null> {
    try {
      return await this.locator.getAttribute(name);
    } catch {
      return null;
    }
  }

  async find(selector: Selector): Promise<IElement | null> {
    try {
      const locator = this.createLocator(selector);
      const count = await locator.count();

      if (count === 0) {
        return null;
      }

      return new PlaywrightElement(locator.first());
    } catch {
      return null;
    }
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    try {
      const locator = this.createLocator(selector);
      const all = await locator.all();
      return all.map(loc => new PlaywrightElement(loc));
    } catch {
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

  constructor(private existingBrowser?: Browser) {}

  async goto(url: string): Promise<void> {
    // Create page if not exists
    if (!this.page) {
      if (this.existingBrowser) {
        this.page = await this.existingBrowser.newPage();
        this.ownsBrowser = false;
      } else {
        // Import chromium dynamically to avoid loading it when using Cheerio
        const { chromium } = await import('playwright');
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
        this.ownsBrowser = true;
      }

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

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1000); // Brief wait for dynamic content
  }

  async extract(selector: Selector): Promise<string | null> {
    if (!this.page) {
      throw new Error('No page loaded. Call goto() first.');
    }

    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(selector.type, selectorValue);
        const count = await locator.count();

        if (count === 0) {
          continue;
        }

        const value = await this.extractValue(locator.first(), selector.extract || 'text');
        if (value) {
          return value;
        }
      } catch {
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
        const count = await locator.count();

        if (count === 0) {
          continue;
        }

        const all = await locator.all();
        return all.map(loc => new PlaywrightElement(loc));
      } catch {
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
        const count = await locator.count();

        if (count > 0) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    // Only close browser if we created it
    if (this.ownsBrowser && this.browser) {
      await this.browser.close();
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
    } catch {
      return null;
    }
  }
}
