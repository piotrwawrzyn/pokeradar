import { chromium, Browser, Page, Locator } from 'playwright';
import { ShopConfig, WatchlistProduct, ProductResult } from '../types';
import { SelectorEngine } from '../utils/selectorEngine';
import { PriceParser } from '../utils/priceParser';
import { Logger } from '../services/Logger';

/**
 * Base scraper class implementing the template method pattern.
 * Provides default implementation for most shops, with hooks for customization.
 */
export abstract class BaseScraper {
  protected selectorEngine: SelectorEngine;
  protected priceParser: PriceParser;
  protected logger: Logger;

  constructor(
    protected config: ShopConfig,
    logger?: Logger
  ) {
    this.selectorEngine = new SelectorEngine();
    this.priceParser = new PriceParser();
    this.logger = logger || new Logger();
  }

  /**
   * Main template method that orchestrates the scraping process.
   */
  async scrapeProduct(product: WatchlistProduct): Promise<ProductResult> {
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      // Step 1: Search for product and get its URL
      const productUrl = await this.findProductUrl(page, product);

      if (!productUrl) {
        this.logger.info('Product not found in search', {
          shop: this.config.id,
          product: product.id
        });
        return this.createNullResult(product);
      }

      // Step 2: Navigate to product page
      await this.navigateToProductPage(page, productUrl);

      // Step 3: Extract title, price and availability from product page
      const productTitle = await this.extractTitle(page);
      const price = await this.extractPrice(page);
      const isAvailable = await this.checkAvailability(page);

      this.logger.debug('Product scraped successfully', {
        shop: this.config.id,
        product: product.id,
        productTitle,
        price,
        isAvailable
      });

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
        productTitle: productTitle || undefined,
        price,
        isAvailable,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Error scraping product', {
        shop: this.config.id,
        product: product.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return this.createNullResult(product);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Searches for the product and returns its URL.
   * This is a template method that can be overridden by custom scrapers.
   */
  protected async findProductUrl(
    page: Page,
    product: WatchlistProduct
  ): Promise<string | null> {
    for (const phrase of product.searchPhrases) {
      const url = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(phrase)}`;

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(1000);

      // Get all product articles
      const articles = await this.selectorEngine.extractAll(
        page,
        this.config.selectors.searchPage.article
      );

      // If articles found, take the first one
      if (articles.length > 0) {
        const firstArticle = articles[0];

        const productUrl = await this.selectorEngine.extract(
          firstArticle,
          this.config.selectors.searchPage.productUrl
        );

        if (productUrl) {
          return this.normalizeUrl(productUrl);
        }
      }
    }

    return null;
  }

  /**
   * Navigates to the product page.
   * Can be overridden for custom navigation logic.
   */
  protected async navigateToProductPage(
    page: Page,
    productUrl: string
  ): Promise<void> {
    await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
    // Wait a bit for dynamic content
    await page.waitForTimeout(1000);
  }

  /**
   * Extracts the product title from the product page.
   * Can be overridden for custom title extraction logic.
   */
  protected async extractTitle(page: Page): Promise<string | null> {
    const title = await this.selectorEngine.extract(
      page,
      this.config.selectors.productPage.title
    );

    return title;
  }

  /**
   * Extracts the price from the product page.
   * Can be overridden for custom price extraction logic.
   */
  protected async extractPrice(page: Page): Promise<number | null> {
    const priceText = await this.selectorEngine.extract(
      page,
      this.config.selectors.productPage.price
    );

    if (!priceText) {
      return null;
    }

    const format = this.config.selectors.productPage.price.format || 'european';
    return this.priceParser.parse(priceText, format);
  }

  /**
   * Checks if the product is available.
   * Can be overridden for custom availability logic.
   */
  protected async checkAvailability(page: Page): Promise<boolean> {
    const availSelector = this.config.selectors.productPage.available;

    // Handle both single selector and array of selectors
    const selectors = Array.isArray(availSelector) ? availSelector : [availSelector];

    // Try each availability selector
    for (const selector of selectors) {
      const availText = await this.selectorEngine.extract(page, selector);

      if (!availText) {
        continue; // Try next selector
      }

      const expectedText = selector.matchText;
      if (!expectedText) {
        // If no matchText specified, presence of element means available
        return true;
      }

      if (availText.includes(expectedText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if the extracted title matches the product name.
   * Can be overridden for custom matching logic.
   */
  protected titleMatches(titleText: string | null, productName: string): boolean {
    if (!titleText) {
      return false;
    }

    const normalizedTitle = titleText.toLowerCase().trim();
    const normalizedProduct = productName.toLowerCase().trim();

    return normalizedTitle.includes(normalizedProduct);
  }

  /**
   * Normalizes a URL (handles relative URLs).
   */
  protected normalizeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // Handle absolute paths
    if (url.startsWith('/')) {
      return `${this.config.baseUrl}${url}`;
    }

    // Handle relative paths (rare but possible)
    return `${this.config.baseUrl}/${url}`;
  }

  /**
   * Creates a null result when product is not found or scraping fails.
   */
  protected createNullResult(product: WatchlistProduct): ProductResult {
    return {
      productId: product.id,
      shopId: this.config.id,
      productUrl: '',
      price: null,
      isAvailable: false,
      timestamp: new Date()
    };
  }
}
