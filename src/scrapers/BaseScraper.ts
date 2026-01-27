import { ShopConfig, WatchlistProductInternal, ProductResult } from '../types';
import { IEngine } from '../engines';
import { PriceParser } from '../utils/priceParser';
import { Logger } from '../services/Logger';
import * as fuzz from 'fuzzball';

/**
 * Base scraper class implementing the template method pattern.
 * Provides default implementation for most shops, with hooks for customization.
 * Engine-agnostic - works with both Cheerio and Playwright engines.
 */
export abstract class BaseScraper {
  protected priceParser: PriceParser;
  protected logger: Logger;

  constructor(
    protected config: ShopConfig,
    protected engine: IEngine,
    logger?: Logger
  ) {
    this.priceParser = new PriceParser();
    this.logger = logger || new Logger();
  }

  /**
   * Main template method that orchestrates the scraping process.
   */
  async scrapeProduct(product: WatchlistProductInternal): Promise<ProductResult> {
    try {
      // Step 1: Search for product and get its URL
      const searchResult = await this.findProductUrl(product);

      if (!searchResult) {
        this.logger.info('Product not found in search', {
          shop: this.config.id,
          product: product.id
        });
        return this.createNullResult(product);
      }

      const { url: productUrl, isDirectHit } = searchResult;

      // Step 2: Navigate to product page (skip if direct hit - already there)
      if (!isDirectHit) {
        await this.navigateToProductPage(productUrl);
      }

      // Step 3: Extract price and availability from product page
      const price = await this.extractPrice();
      const isAvailable = await this.checkAvailability();

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
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
    }
  }

  /**
   * Searches for the product and returns its URL.
   * This is a template method that can be overridden by custom scrapers.
   */
  protected async findProductUrl(
    product: WatchlistProductInternal
  ): Promise<{ url: string; isDirectHit: boolean } | null> {
    for (const phrase of product.search.phrases) {
      const encodedQuery = encodeURIComponent(phrase);
      const searchPath = this.config.searchUrl.includes('{query}')
        ? this.config.searchUrl.replace('{query}', encodedQuery)
        : `${this.config.searchUrl}${encodedQuery}`;
      const url = `${this.config.baseUrl}${searchPath}`;

      await this.engine.goto(url);

      // Check for direct hit - search redirected to product page
      if (this.config.directHitPattern) {
        const currentUrl = this.engine.getCurrentUrl();
        if (currentUrl && new RegExp(this.config.directHitPattern).test(currentUrl)) {
          this.logger.info('Direct hit detected - validating product match', {
            shop: this.config.id,
            product: product.id,
            phrase,
            productUrl: currentUrl
          });

          // Validate the direct hit matches what we're looking for
          const isValid = await this.validateDirectHit(product, phrase);
          if (isValid) {
            return { url: currentUrl, isDirectHit: true };
          }

          this.logger.info('Direct hit validation failed - product does not match', {
            shop: this.config.id,
            product: product.id,
            phrase
          });
          continue; // Try next search phrase
        }
      }

      // Get all product articles
      const articles = await this.engine.extractAll(
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

      // Extract titles and URLs, find best match using fuzzy matching
      // Only check first 5 results to avoid processing irrelevant items
      const candidates: Array<{ title: string; url: string; score: number }> = [];
      const articlesToCheck = articles.slice(0, 5);

      for (const article of articlesToCheck) {
        const titleElement = await article.find(this.config.selectors.searchPage.title);
        const title = titleElement ? await titleElement.getText() : null;

        const urlElement = await article.find(this.config.selectors.searchPage.productUrl);
        const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

        if (title && productUrl) {
          // Validate title (checks exclude list and returns fuzzy score)
          const score = this.validateTitle(title, phrase, product);
          if (score === null) {
            continue; // Excluded, skip this candidate
          }

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
        return { url: this.normalizeUrl(bestMatchUrl), isDirectHit: false };
      }
    }

    return null;
  }

  /**
   * Navigates to the product page.
   * Can be overridden for custom navigation logic.
   */
  protected async navigateToProductPage(productUrl: string): Promise<void> {
    await this.engine.goto(productUrl);
  }

  /**
   * Extracts the price from the product page.
   * Can be overridden for custom price extraction logic.
   */
  protected async extractPrice(): Promise<number | null> {
    const priceText = await this.engine.extract(
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
  protected async checkAvailability(): Promise<boolean> {
    const availSelector = this.config.selectors.productPage.available;

    // Handle both single selector and array of selectors
    const selectors = Array.isArray(availSelector) ? availSelector : [availSelector];

    // Try each availability selector - presence of matching element means available
    for (const selector of selectors) {
      const exists = await this.engine.exists(selector);

      // Debug: log what we found
      if (exists) {
        const text = await this.engine.extract(selector);
        this.logger?.debug('Availability check matched', {
          shop: this.config.id,
          selector: typeof selector === 'string' ? selector : selector.value,
          matchedText: text?.substring(0, 100)
        });
        return true;
      }
    }

    this.logger?.debug('Availability check: no match found', {
      shop: this.config.id
    });

    return false;
  }

  /**
   * Normalizes text for matching (lowercase, normalize dashes/spaces).
   */
  private normalizeForMatching(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[–—‐‑−]/g, '-')  // Normalize various dashes to hyphen
      .replace(/[-:]+/g, ' ')     // Replace dashes and colons with space
      .replace(/\s+/g, ' ');      // Collapse multiple spaces
  }

  /**
   * Checks if the extracted title matches the product name.
   * Can be overridden for custom matching logic.
   */
  protected titleMatches(titleText: string | null, productName: string): boolean {
    if (!titleText) {
      return false;
    }

    const normalizedTitle = this.normalizeForMatching(titleText);
    const normalizedProduct = this.normalizeForMatching(productName);

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
   * Closes the underlying engine and releases resources.
   */
  async close(): Promise<void> {
    await this.engine.close();
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
   * Validates a title against exclude list and returns fuzzy match score.
   * Returns null if title is excluded, otherwise returns the fuzzy score.
   */
  protected validateTitle(
    title: string,
    phrase: string,
    product: WatchlistProductInternal
  ): number | null {
    // Check exclude list
    if (product.search.exclude && product.search.exclude.length > 0) {
      const titleLower = title.toLowerCase();
      const isExcluded = product.search.exclude.some(word =>
        titleLower.includes(word.toLowerCase())
      );
      if (isExcluded) {
        this.logger.debug('Title contains excluded word', {
          shop: this.config.id,
          product: product.id,
          title,
          exclude: product.search.exclude
        });
        return null;
      }
    }

    // Return fuzzy match score
    return fuzz.token_set_ratio(title, phrase);
  }

  /**
   * Validates a direct hit by extracting and checking the product page title.
   * Uses a lower threshold (90) since the search engine already matched this product.
   */
  protected async validateDirectHit(
    product: WatchlistProductInternal,
    phrase: string
  ): Promise<boolean> {
    const MIN_SCORE_THRESHOLD = 90;

    // Get title selector from product page config
    const titleSelector = this.config.selectors.productPage.title;
    if (!titleSelector) {
      this.logger.debug('No productPage.title selector configured, accepting direct hit', {
        shop: this.config.id
      });
      return true;
    }

    // Extract title from product page
    const title = await this.engine.extract(titleSelector);
    if (!title) {
      this.logger.debug('Could not extract title from product page', {
        shop: this.config.id,
        product: product.id
      });
      return false;
    }

    // Validate title
    const score = this.validateTitle(title, phrase, product);
    if (score === null) {
      return false;
    }

    if (score < MIN_SCORE_THRESHOLD) {
      this.logger.debug('Direct hit fuzzy match score too low', {
        shop: this.config.id,
        product: product.id,
        title,
        phrase,
        score,
        threshold: MIN_SCORE_THRESHOLD
      });
      return false;
    }

    this.logger.info('Direct hit validated', {
      shop: this.config.id,
      product: product.id,
      title,
      score
    });
    return true;
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
