import { chromium, Browser, Page } from 'playwright';
import { ShopConfig } from '../../src/types';
import { SelectorEngine } from '../../src/utils/selectorEngine';
import { PriceParser } from '../../src/utils/priceParser';

export interface TestResult {
  passed: boolean;
  error?: string;
  value?: any;
}

export class ShopTester {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private selectorEngine: SelectorEngine;
  private priceParser: PriceParser;

  constructor(private config: ShopConfig) {
    this.selectorEngine = new SelectorEngine();
    this.priceParser = new PriceParser();
  }

  async setup(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Test product page price extraction
   */
  async testPriceExtraction(productUrl: string): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      await this.page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);

      const priceText = await this.selectorEngine.extract(
        this.page,
        this.config.selectors.productPage.price
      );

      if (!priceText) {
        return { passed: false, error: 'Price element not found' };
      }

      const format = this.config.selectors.productPage.price.format || 'european';
      const price = this.priceParser.parse(priceText, format);

      if (price === null) {
        return { passed: false, error: `Price parsing failed for: "${priceText}"` };
      }

      if (price <= 0) {
        return { passed: false, error: `Invalid price value: ${price}` };
      }

      return { passed: true, value: { priceText, price } };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test product page availability extraction
   */
  async testAvailabilityExtraction(productUrl: string): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      await this.page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);

      const availSelector = this.config.selectors.productPage.available;
      const selectors = Array.isArray(availSelector) ? availSelector : [availSelector];

      let foundAvailability = false;
      let availabilityText = '';

      for (const selector of selectors) {
        const text = await this.selectorEngine.extract(this.page, selector);
        if (text) {
          foundAvailability = true;
          availabilityText = text;
          break;
        }
      }

      if (!foundAvailability) {
        return { passed: false, error: 'Availability element not found' };
      }

      return { passed: true, value: { availabilityText } };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test product page title extraction
   */
  async testTitleExtraction(productUrl: string): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      await this.page.goto(productUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);

      const title = await this.selectorEngine.extract(
        this.page,
        this.config.selectors.productPage.title
      );

      if (!title) {
        return { passed: false, error: 'Product title not found' };
      }

      return { passed: true, value: { title } };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test search page - finding articles
   */
  async testSearchArticles(searchPhrase: string): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      const searchUrl = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(searchPhrase)}`;
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);

      const articles = await this.selectorEngine.extractAll(
        this.page,
        this.config.selectors.searchPage.article
      );

      if (articles.length === 0) {
        return { passed: false, error: 'No articles found in search results' };
      }

      return { passed: true, value: { articleCount: articles.length } };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test search page - URL extraction from first article
   */
  async testSearchUrlExtraction(searchPhrase: string): Promise<TestResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      const searchUrl = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(searchPhrase)}`;
      await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);

      const articles = await this.selectorEngine.extractAll(
        this.page,
        this.config.selectors.searchPage.article
      );

      if (articles.length === 0) {
        return { passed: false, error: 'No articles found' };
      }

      const firstArticle = articles[0];
      const productUrl = await this.selectorEngine.extract(
        firstArticle,
        this.config.selectors.searchPage.productUrl
      );

      if (!productUrl) {
        return { passed: false, error: 'Product URL not found in first article' };
      }

      return { passed: true, value: { productUrl } };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

}
