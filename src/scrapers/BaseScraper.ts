import { chromium, Browser, Page, Locator } from 'playwright';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../types';
import { SelectorEngine } from '../utils/selectorEngine';
import { PriceParser } from '../utils/priceParser';
import { Logger } from '../services/Logger';
import * as fuzz from 'fuzzball';

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
   * Optionally accepts an existing browser instance to reuse.
   */
  async scrapeProduct(product: WatchlistProductInternal, existingBrowser?: Browser): Promise<ProductResult> {
    const ownsBrowser = !existingBrowser;
    let browser: Browser | null = existingBrowser || null;
    let page: Page | null = null;

    try {
      if (!browser) {
        browser = await chromium.launch({ headless: true });
      }
      page = await browser.newPage();

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
      // Always close the page to free memory
      if (page) {
        await page.close();
      }
      // Only close browser if we created it ourselves
      if (ownsBrowser && browser) {
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
    product: WatchlistProductInternal
  ): Promise<string | null> {
    for (const phrase of product.search.phrases) {
      const url = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(phrase)}`;

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(1000);

      // Get all product articles
      const articles = await this.selectorEngine.extractAll(
        page,
        this.config.selectors.searchPage.article
      );

      // If no articles found, try next search phrase
      if (articles.length === 0) {
        this.logger.info('No product articles found on search page', {
          shop: this.config.id,
          product: product.id,
          phrase
        });
        continue; // Try next search phrase
      }

      // If only one result, still check exclusions and fuzzy match before using it
      if (articles.length === 1) {
        const title = await this.selectorEngine.extract(
          articles[0],
          this.config.selectors.searchPage.title
        );

        // Check exclude list even for single results
        if (title && product.search.exclude && product.search.exclude.length > 0) {
          if (this.isExcluded(title, product.search.exclude)) {
            this.logger.debug('Single result contains excluded word, skipping', {
              shop: this.config.id,
              product: product.id,
              title,
              exclude: product.search.exclude
            });
            continue; // Try next search phrase
          }
        }

        // Check fuzzy match score for single results too
        if (title) {
          const score = fuzz.token_set_ratio(title, phrase);
          if (score < 95) {
            this.logger.debug('Single result fuzzy match too low, skipping', {
              shop: this.config.id,
              product: product.id,
              title,
              phrase,
              score
            });
            continue; // Try next search phrase
          }
        }

        const productUrl = await this.selectorEngine.extract(
          articles[0],
          this.config.selectors.searchPage.productUrl
        );

        if (productUrl) {
          this.logger.info('Single search result found, using it', {
            shop: this.config.id,
            product: product.id,
            phrase,
            title
          });
          return this.normalizeUrl(productUrl);
        }
      }

      // Multiple results: extract titles and URLs, find best match using fuzzy matching
      // Only check first 5 results to avoid processing irrelevant items
      const candidates: Array<{ title: string; url: string; score: number }> = [];
      const articlesToCheck = articles.slice(0, 5);

      for (const article of articlesToCheck) {
        const title = await this.selectorEngine.extract(
          article,
          this.config.selectors.searchPage.title
        );

        const productUrl = await this.selectorEngine.extract(
          article,
          this.config.selectors.searchPage.productUrl
        );

        if (title && productUrl) {
          // Check exclude list - skip if title contains any excluded words
          if (product.search.exclude && product.search.exclude.length > 0) {
            if (this.isExcluded(title, product.search.exclude)) {
              this.logger.debug('Product title contains excluded word, skipping', {
                shop: this.config.id,
                product: product.id,
                title,
                exclude: product.search.exclude
              });
              continue; // Skip this candidate
            }
          }

          // Calculate match score using token_set_ratio (ignores word order, handles extra words)
          const score = fuzz.token_set_ratio(title, phrase);

          candidates.push({
            title,
            url: productUrl,
            score
          });
        }
      }

      // Select best candidate from search results
      const bestMatchUrl = this.selectBestCandidate(candidates, product, phrase);

      if (bestMatchUrl) {
        return this.normalizeUrl(bestMatchUrl);
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

    try {
      return this.priceParser.parse(priceText, format);
    } catch (error) {
      this.logger.error('Price parsing failed', {
        shop: this.config.id,
        priceText,
        format,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
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
  protected createNullResult(product: WatchlistProductInternal): ProductResult {
    return {
      productId: product.id,
      shopId: this.config.id,
      productUrl: '',
      price: null,
      isAvailable: false,
      timestamp: new Date()
    };
  }

  /**
   * Checks if a title contains any excluded words.
   */
  protected isExcluded(title: string, excludeWords: string[]): boolean {
    const titleLower = title.toLowerCase();
    return excludeWords.some(word => titleLower.includes(word.toLowerCase()));
  }

  /**
   * Selects the best matching product from candidates.
   * Returns the URL if a good match is found, null otherwise.
   */
  protected selectBestCandidate(
    candidates: Array<{ title: string; url: string; score: number }>,
    product: WatchlistProductInternal,
    phrase: string
  ): string | null {
    const MIN_SCORE_THRESHOLD = 95; // Require high confidence for multiple results

    if (candidates.length === 0) {
      return null;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates[0];

    // Check if score meets threshold
    if (bestMatch.score < MIN_SCORE_THRESHOLD) {
      this.logger.warn('Best match score too low, product likely not in results', {
        shop: this.config.id,
        product: product.id,
        title: bestMatch.title,
        score: bestMatch.score,
        threshold: MIN_SCORE_THRESHOLD,
        phrase
      });
      return null;
    }

    this.logger.info('Found product match', {
      shop: this.config.id,
      product: product.id,
      title: bestMatch.title,
      score: bestMatch.score
    });

    return bestMatch.url;
  }
}
