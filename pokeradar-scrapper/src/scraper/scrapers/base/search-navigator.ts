/**
 * Search and navigation logic for product scraping.
 */

import { ShopConfig, WatchlistProductInternal } from '../../../shared/types';
import { IEngine } from '../../engines/engine.interface';
import { normalizeUrl, buildSearchUrl } from '../../../shared/utils/url-normalizer';
import { ProductMatcher, ProductCandidate } from './product-matcher';

/**
 * Logger interface for search navigation.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Result of a product search.
 */
export interface SearchResult {
  url: string;
  isDirectHit: boolean;
}

/**
 * Handles product search and URL discovery.
 */
export class SearchNavigator {
  constructor(
    private config: ShopConfig,
    private engine: IEngine,
    private matcher: ProductMatcher,
    private logger?: ILogger
  ) {}

  /**
   * Searches for a product and returns its URL.
   */
  async findProductUrl(
    product: WatchlistProductInternal
  ): Promise<SearchResult | null> {
    for (const phrase of product.search.phrases) {
      const searchUrl = buildSearchUrl(
        this.config.baseUrl,
        this.config.searchUrl,
        phrase
      );

      await this.engine.goto(searchUrl);

      // Check for direct hit - search redirected to product page
      const directHitResult = await this.checkDirectHit(product, phrase);
      if (directHitResult) {
        return directHitResult;
      }

      // Get all product articles from search results
      const productUrl = await this.findInSearchResults(product, phrase);
      if (productUrl) {
        return { url: normalizeUrl(productUrl, this.config.baseUrl), isDirectHit: false };
      }
    }

    return null;
  }

  /**
   * Checks if search resulted in a direct hit to product page.
   */
  private async checkDirectHit(
    product: WatchlistProductInternal,
    phrase: string
  ): Promise<SearchResult | null> {
    if (!this.config.directHitPattern) {
      return null;
    }
    
    const currentUrl = this.engine.getCurrentUrl();
    if (!currentUrl || !new RegExp(this.config.directHitPattern).test(currentUrl)) {
      return null;
    }

    this.logger?.info('Direct hit detected - validating product match', {
      shop: this.config.id,
      product: product.id,
      phrase,
      productUrl: currentUrl,
    });

    const isValid = await this.validateDirectHit(product, phrase);
    if (isValid) {
      return { url: currentUrl, isDirectHit: true };
    }

    this.logger?.info('Direct hit validation failed - product does not match', {
      shop: this.config.id,
      product: product.id,
      phrase,
    });

    return null;
  }

  /**
   * Validates a direct hit by checking the product page title.
   */
  private async validateDirectHit(
    product: WatchlistProductInternal,
    phrase: string
  ): Promise<boolean> {
    const titleSelector = this.config.selectors.productPage.title;
    if (!titleSelector) {
      this.logger?.debug('No productPage.title selector configured, accepting direct hit', {
        shop: this.config.id,
      });
      return true;
    }

    const title = await this.engine.extract(titleSelector);
    if (!title) {
      this.logger?.debug('Could not extract title from product page', {
        shop: this.config.id,
        product: product.id,
      });
      return false;
    }

    const score = this.matcher.validateTitle(title, phrase, product, this.config.id);
    if (score === null) {
      return false;
    }

    if (!this.matcher.isValidDirectHitScore(score)) {
      this.logger?.debug('Direct hit fuzzy match score too low', {
        shop: this.config.id,
        product: product.id,
        title,
        phrase,
        score,
        threshold: this.matcher.getDirectHitThreshold(),
      });
      return false;
    }

    this.logger?.info('Direct hit validated', {
      shop: this.config.id,
      product: product.id,
      title,
      score,
    });
    return true;
  }

  /**
   * Searches for product in search results page.
   */
  private async findInSearchResults(
    product: WatchlistProductInternal,
    phrase: string
  ): Promise<string | null> {
    const articles = await this.engine.extractAll(
      this.config.selectors.searchPage.article
    );

    if (articles.length === 0) {
      this.logger?.info('No product articles found on search page', {
        shop: this.config.id,
        product: product.id,
        phrase,
      });
      return null;
    }

    // Extract titles and URLs, find best match using fuzzy matching
    // Only check first 5 results to avoid processing irrelevant items
    const candidates: ProductCandidate[] = [];
    const articlesToCheck = articles.slice(0, 5);

    for (const article of articlesToCheck) {
      const titleSelector = this.config.selectors.searchPage.title;
      let title: string | null = null;

      // If title selector has "extract" property, get attribute instead of text
      if ('extract' in titleSelector && titleSelector.extract) {
        title = await article.getAttribute(titleSelector.extract);
      } else {
        const titleElement = await article.find(titleSelector);
        title = titleElement ? await titleElement.getText() : null;
      }

      const urlElement = await article.find(this.config.selectors.searchPage.productUrl);
      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

      if (title && productUrl) {
        const score = this.matcher.validateTitle(title, phrase, product, this.config.id);
        if (score !== null) {
          candidates.push({ title, url: productUrl, score });
        }
      }
    }

    return this.matcher.selectBestCandidate(candidates, product, phrase, this.config.id);
  }

  /**
   * Performs a set-level search and extracts all article candidates (title + URL).
   * Does NOT do product-specific matching. Used for set-based searching
   * where one search covers multiple products.
   */
  async extractSearchCandidates(
    searchPhrase: string,
    maxArticles: number = 20
  ): Promise<ProductCandidate[]> {
    const searchUrl = buildSearchUrl(
      this.config.baseUrl,
      this.config.searchUrl,
      searchPhrase
    );

    await this.engine.goto(searchUrl);

    const articles = await this.engine.extractAll(
      this.config.selectors.searchPage.article
    );

    if (articles.length === 0) {
      this.logger?.info('No articles found for set search', {
        shop: this.config.id,
        phrase: searchPhrase,
      });
      return [];
    }

    const candidates: ProductCandidate[] = [];
    for (const article of articles) {
      const titleSelector = this.config.selectors.searchPage.title;
      let title: string | null = null;

      // If title selector has "extract" property, get attribute instead of text
      if ('extract' in titleSelector && titleSelector.extract) {
        // For attribute extraction from article itself, don't use find()
        title = await article.getAttribute(titleSelector.extract);
      } else {
        const titleElement = await article.find(titleSelector);
        title = titleElement ? await titleElement.getText() : null;
      }

      const urlElement = await article.find(this.config.selectors.searchPage.productUrl);
      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

      if (title && productUrl) {
        candidates.push({
          title,
          url: normalizeUrl(productUrl, this.config.baseUrl),
          score: 0,
        });
      }
    }

    return candidates;
  }

  /**
   * Matches a specific product against pre-extracted search candidates.
   * Tries each of the product's search phrases against the candidates.
   * Returns the best matching URL or null. No HTTP requests.
   */
  matchProductFromCandidates(
    product: WatchlistProductInternal,
    candidates: ProductCandidate[]
  ): string | null {
    for (const phrase of product.search.phrases) {
      const scoredCandidates: ProductCandidate[] = [];

      for (const candidate of candidates) {
        const score = this.matcher.validateTitle(
          candidate.title,
          phrase,
          product,
          this.config.id
        );

        if (score !== null) {
          scoredCandidates.push({ ...candidate, score });
        }
      }

      const bestUrl = this.matcher.selectBestCandidate(
        scoredCandidates,
        product,
        phrase,
        this.config.id
      );

      if (bestUrl) {
        return bestUrl;
      }
    }

    return null;
  }

  /**
   * Navigates to a product page.
   */
  async navigateToProductPage(productUrl: string): Promise<void> {
    await this.engine.goto(productUrl);
  }
}
