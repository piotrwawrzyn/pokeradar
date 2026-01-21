import { Browser } from 'playwright';
import { ShopConfig } from '../../src/types';
import { PlaywrightEngine } from '../../src/engines/PlaywrightEngine';
import { PriceParser } from '../../src/utils/priceParser';

export interface TestResult {
  passed: boolean;
  error?: string;
  value?: any;
}

export class ShopTester {
  private browser: Browser | null = null;
  private engine: PlaywrightEngine | null = null;
  private priceParser: PriceParser;

  constructor(private config: ShopConfig) {
    this.priceParser = new PriceParser();
  }

  async setup(): Promise<void> {
    // Import chromium dynamically
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    this.engine = new PlaywrightEngine(this.browser);
  }

  async teardown(): Promise<void> {
    if (this.engine) {
      await this.engine.close();
      this.engine = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Test product page price extraction
   */
  async testPriceExtraction(productUrl: string): Promise<TestResult> {
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      await this.engine.goto(productUrl);

      const priceText = await this.engine.extract(
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
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      await this.engine.goto(productUrl);

      const availSelector = this.config.selectors.productPage.available;
      const selectors = Array.isArray(availSelector) ? availSelector : [availSelector];

      let isAvailable = false;

      for (const selector of selectors) {
        const exists = await this.engine.exists(selector);
        if (exists) {
          isAvailable = true;
          break;
        }
      }

      return { passed: true, value: { isAvailable } };
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
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      const searchUrl = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(searchPhrase)}`;
      await this.engine.goto(searchUrl);

      const articles = await this.engine.extractAll(
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
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      const searchUrl = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(searchPhrase)}`;
      await this.engine.goto(searchUrl);

      const articles = await this.engine.extractAll(
        this.config.selectors.searchPage.article
      );

      if (articles.length === 0) {
        return { passed: false, error: 'No articles found' };
      }

      const firstArticle = articles[0];
      const urlElement = await firstArticle.find(this.config.selectors.searchPage.productUrl);
      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

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
