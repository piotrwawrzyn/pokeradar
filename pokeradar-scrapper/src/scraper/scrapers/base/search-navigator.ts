/**
 * Search and navigation logic for product scraping.
 */

import { ShopConfig, WatchlistProductInternal } from '../../../shared/types';
import { IEngine, IElement } from '../../engines/engine.interface';
import { normalizeUrl, buildSearchUrl } from '../../../shared/utils/url-normalizer';
import { ProductMatcher, ProductCandidate } from './product-matcher';
import { PriceParser } from '../../../shared/utils/price-parser';

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
  searchPageData?: {
    price: number | null;
    isAvailable: boolean;
  };
}

/**
 * Result of matching a product from pre-extracted candidates.
 */
export interface MatchResult {
  url: string;
  searchPageData?: {
    price: number | null;
    isAvailable: boolean;
  };
}

/**
 * Handles product search and URL discovery.
 */
export class SearchNavigator {
  private priceParser = new PriceParser();

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
      const result = await this.findInSearchResults(product, phrase);
      if (result) {
        return {
          url: normalizeUrl(result.url, this.config.baseUrl),
          isDirectHit: false,
          searchPageData: result.searchPageData,
        };
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
  ): Promise<{ url: string; searchPageData?: { price: number | null; isAvailable: boolean } } | null> {
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

    // Extract titles and URLs in parallel for all articles
    const candidatePromises = articles.map(async (article): Promise<ProductCandidate | null> => {
      const titleSelector = this.config.selectors.searchPage.title;

      // Parallelize all element lookups for this article
      const [titleResult, urlElement, searchPageData] = await Promise.all([
        // Get title (either attribute or text)
        'extract' in titleSelector && titleSelector.extract
          ? article.getAttribute(titleSelector.extract)
          : article.find(titleSelector).then(el => el?.getText() ?? null),
        // Get URL
        article.find(this.config.selectors.searchPage.productUrl),
        // Get search page data (price, availability)
        this.extractSearchPageData(article),
      ]);

      const title = titleResult;
      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

      if (!title || !productUrl) {
        return null;
      }

      const score = this.matcher.validateTitle(title, phrase, product, this.config.id);
      if (score === null) {
        return null;
      }

      const candidate: ProductCandidate = {
        title,
        url: productUrl,
        score,
      };

      if (searchPageData) {
        candidate.searchPageData = searchPageData;
      }

      return candidate;
    });

    // Wait for all articles to be processed in parallel
    const results = await Promise.all(candidatePromises);
    const candidates: ProductCandidate[] = results.filter((c): c is ProductCandidate => c !== null);

    const bestUrl = this.matcher.selectBestCandidate(candidates, product, phrase, this.config.id);

    if (bestUrl) {
      const matchedCandidate = candidates.find(c => c.url === bestUrl);
      return {
        url: bestUrl,
        searchPageData: matchedCandidate?.searchPageData,
      };
    }
    return null;
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

    // Process all articles in parallel
    const candidatePromises = articles.map(async (article): Promise<ProductCandidate | null> => {
      const titleSelector = this.config.selectors.searchPage.title;

      // Parallelize all element lookups for this article
      const [titleResult, urlElement, searchPageData] = await Promise.all([
        // Get title (either attribute or text)
        'extract' in titleSelector && titleSelector.extract
          ? article.getAttribute(titleSelector.extract)
          : article.find(titleSelector).then(el => el?.getText() ?? null),
        // Get URL
        article.find(this.config.selectors.searchPage.productUrl),
        // Get search page data (price, availability)
        this.extractSearchPageData(article),
      ]);

      const title = titleResult;
      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;

      if (!title || !productUrl) {
        return null;
      }

      const candidate: ProductCandidate = {
        title,
        url: normalizeUrl(productUrl, this.config.baseUrl),
        score: 0,
      };

      if (searchPageData) {
        candidate.searchPageData = searchPageData;
      }

      return candidate;
    });

    const results = await Promise.all(candidatePromises);
    return results.filter((c): c is ProductCandidate => c !== null);
  }

  /**
   * Matches a specific product against pre-extracted search candidates.
   * Tries each of the product's search phrases against the candidates.
   * Returns the best matching result or null. No HTTP requests.
   */
  matchProductFromCandidates(
    product: WatchlistProductInternal,
    candidates: ProductCandidate[]
  ): MatchResult | null {
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
        const matchedCandidate = scoredCandidates.find(c => c.url === bestUrl);
        return {
          url: bestUrl,
          searchPageData: matchedCandidate?.searchPageData,
        };
      }
    }

    return null;
  }

  /**
   * Attempts to extract price and availability from a search page article element.
   * Returns enriched data if BOTH price and availability can be determined, null otherwise.
   */
  private async extractSearchPageData(
    article: IElement
  ): Promise<{ price: number | null; isAvailable: boolean } | null> {
    const searchSelectors = this.config.selectors.searchPage;

    // Must have at least one availability selector AND price selector
    const hasAvailabilitySelector = !!searchSelectors.available || !!searchSelectors.unavailable;
    const hasPriceSelector = !!searchSelectors.price;

    if (!hasAvailabilitySelector || !hasPriceSelector) {
      return null;
    }

    // Parallelize all selector lookups
    const availSelectors = searchSelectors.available
      ? (Array.isArray(searchSelectors.available) ? searchSelectors.available : [searchSelectors.available])
      : [];
    const unavailSelectors = searchSelectors.unavailable
      ? (Array.isArray(searchSelectors.unavailable) ? searchSelectors.unavailable : [searchSelectors.unavailable])
      : [];
    const priceSelector = searchSelectors.price!;

    // Run all find operations in parallel
    const [availElements, unavailElements, priceElement] = await Promise.all([
      Promise.all(availSelectors.map(selector => article.find(selector))),
      Promise.all(unavailSelectors.map(selector => article.find(selector))),
      article.find(priceSelector),
    ]);

    // Determine availability from results
    let isAvailable: boolean | null = null;

    // Check if any available element was found
    if (availElements.some(el => el !== null)) {
      isAvailable = true;
    }

    // If still null, check unavailable elements
    if (isAvailable === null && unavailElements.some(el => el !== null)) {
      isAvailable = false;
    }

    // If we couldn't determine availability, bail out
    if (isAvailable === null) {
      this.logger?.debug('Search page extraction: could not determine availability', {
        shop: this.config.id,
      });
      return null;
    }

    // Extract price
    let price: number | null = null;

    if (priceElement) {
      let priceText: string | null = null;
      if (priceSelector.extract && priceSelector.extract !== 'text') {
        priceText = await priceElement.getAttribute(priceSelector.extract);
      } else {
        priceText = await priceElement.getText();
      }

      if (priceText) {
        const format = priceSelector.format || 'european';
        try {
          price = this.priceParser.parse(priceText, format);
        } catch (error) {
          this.logger?.debug('Search page extraction: price parsing failed', {
            shop: this.config.id,
            priceText,
            error: error instanceof Error ? error.message : String(error),
          });
          // Fall through to null price
        }
      }
    }

    // Price can be null even on success (element not found or parse failure)
    // This is consistent with productPage behavior
    return { price, isAvailable };
  }

  /**
   * Navigates to a product page.
   */
  async navigateToProductPage(productUrl: string): Promise<void> {
    await this.engine.goto(productUrl);
  }
}
