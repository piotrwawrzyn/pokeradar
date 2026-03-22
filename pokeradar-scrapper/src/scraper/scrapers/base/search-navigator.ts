/**
 * Search and navigation logic for product scraping.
 */

import { ShopConfig, Selector } from '@pokeradar/shared';
import { IEngine, IElement } from '../../engines/engine.interface';
import {
  normalizeUrl,
  buildSearchUrl,
  extractTitleFromUrl,
} from '../../../shared/utils/url-normalizer';
import { ProductCandidate } from './helpers/candidate-selector';
import { PriceParser } from '../../../shared/utils/price-parser';

/**
 * Logger interface for search navigation.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Handles search page extraction and navigation.
 */
export class SearchNavigator {
  private priceParser = new PriceParser();

  constructor(
    private config: ShopConfig,
    private engine: IEngine,
    private logger?: ILogger,
  ) {}

  /**
   * Performs a set-level search and extracts all article candidates (title + URL).
   * Does NOT do product-specific matching — pipeline identifies what each candidate is.
   */
  async extractSearchCandidates(searchPhrase: string): Promise<ProductCandidate[]> {
    const searchUrl = buildSearchUrl(this.config.baseUrl, this.config.searchUrl, searchPhrase);

    await this.engine.goto(searchUrl);

    // Detect direct hit: search redirected straight to a product page
    const currentUrl = this.engine.getCurrentUrl();
    const isDirectHit = !!(
      this.config.directHitPattern &&
      currentUrl &&
      new RegExp(this.config.directHitPattern).test(currentUrl)
    );

    if (isDirectHit) {
      this.logger?.debug('Direct hit detected in set search', {
        shop: this.config.id,
        phrase: searchPhrase,
        url: currentUrl,
      });
      return this.extractDirectHitCandidate(currentUrl!);
    }

    const articles = await this.engine.extractAll(this.config.selectors.searchPage.article);

    if (articles.length === 0) {
      this.logger?.debug('No articles found for set search', {
        shop: this.config.id,
        phrase: searchPhrase,
      });
      return [];
    }

    // Process all articles in parallel
    const candidatePromises = articles.map(async (article): Promise<ProductCandidate | null> => {
      const titleSelector = this.config.selectors.searchPage.title;
      const useTitleFromUrl = this.config.selectors.searchPage.titleFromUrl;

      // Parallelize all element lookups for this article
      const [titleResult, urlElement, searchPageData] = await Promise.all([
        // Get title from DOM (skip if using URL slug)
        useTitleFromUrl
          ? Promise.resolve(null)
          : titleSelector && 'extract' in titleSelector && titleSelector.extract
            ? article.getAttribute(titleSelector.extract)
            : titleSelector
              ? article.find(titleSelector).then((el) => el?.getText() ?? null)
              : Promise.resolve(null),
        // Get URL
        article.find(this.config.selectors.searchPage.productUrl),
        // Get search page data (price, availability)
        this.extractSearchPageData(article),
      ]);

      const productUrl = urlElement ? await urlElement.getAttribute('href') : null;
      const title = useTitleFromUrl && productUrl ? extractTitleFromUrl(productUrl) : titleResult;

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
   * Attempts to extract price and availability from a search page article element.
   * Returns enriched data if BOTH price and availability can be determined, null otherwise.
   */
  private async extractSearchPageData(
    article: IElement,
  ): Promise<{ price: number | null; isAvailable: boolean } | null> {
    const searchSelectors = this.config.selectors.searchPage;

    const hasAvailabilitySelector = !!searchSelectors.available || !!searchSelectors.unavailable;

    if (!hasAvailabilitySelector) {
      return null;
    }

    // Parallelize all selector lookups
    const availSelectors = searchSelectors.available
      ? Array.isArray(searchSelectors.available)
        ? searchSelectors.available
        : [searchSelectors.available]
      : [];
    const unavailSelectors = searchSelectors.unavailable
      ? Array.isArray(searchSelectors.unavailable)
        ? searchSelectors.unavailable
        : [searchSelectors.unavailable]
      : [];
    const priceSelector = searchSelectors.price ?? null;

    // Run all find operations in parallel
    // Selectors with matchSelf=true check the article element itself; others search descendants
    const findOrMatch = (selector: Selector, el: IElement) =>
      selector.matchSelf
        ? el.matches(selector).then((matched) => (matched ? el : null))
        : el.find(selector);

    const [availElements, unavailElements, priceElement] = await Promise.all([
      Promise.all(availSelectors.map((selector) => findOrMatch(selector, article))),
      Promise.all(unavailSelectors.map((selector) => findOrMatch(selector, article))),
      priceSelector ? article.find(priceSelector) : Promise.resolve(null),
    ]);

    // Determine availability from results
    let isAvailable: boolean | null = null;

    // Check if any available element was found
    if (availElements.some((el) => el !== null)) {
      isAvailable = true;
    }

    // If still null, check unavailable elements
    if (isAvailable === null && unavailElements.some((el) => el !== null)) {
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

    if (priceElement && priceSelector) {
      let priceText: string | null = null;
      if (priceSelector.extract === 'ownText') {
        priceText = await priceElement.getOwnText();
      } else if (priceSelector.extract && priceSelector.extract !== 'text') {
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
   * Handles a "direct hit" — when a search URL redirects straight to a product page
   * instead of showing search results. Extracts product data from the current page
   * and returns it as a single candidate with searchPageData pre-filled so the
   * downstream flow skips a redundant product page visit.
   */
  private async extractDirectHitCandidate(productUrl: string): Promise<ProductCandidate[]> {
    const pageSelectors = this.config.selectors.productPage;

    // Extract title
    let title: string | null = null;

    if (pageSelectors.title) {
      title = await this.engine.extract(pageSelectors.title);
    }

    if (!title) {
      title = extractTitleFromUrl(productUrl);
    }

    if (!title) {
      this.logger?.debug('Direct hit: could not extract title, skipping', {
        shop: this.config.id,
        url: productUrl,
      });
      return [];
    }

    // Extract price
    let price: number | null = null;
    const priceText = await this.engine.extract(pageSelectors.price);
    if (priceText) {
      const format = pageSelectors.price.format || 'european';
      try {
        price = this.priceParser.parse(priceText, format);
      } catch {
        // Price stays null — consistent with normal flow
      }
    }

    // Check availability
    const availSelectors = Array.isArray(pageSelectors.available)
      ? pageSelectors.available
      : [pageSelectors.available];

    let isAvailable = false;
    for (const selector of availSelectors) {
      if (await this.engine.exists(selector)) {
        isAvailable = true;
        break;
      }
    }

    const candidate: ProductCandidate = {
      title,
      url: productUrl,
      score: 0,
      searchPageData: { price, isAvailable },
    };

    return [candidate];
  }

  /**
   * Navigates to a product page.
   */
  async navigateToProductPage(productUrl: string): Promise<void> {
    await this.engine.goto(productUrl);
  }
}
