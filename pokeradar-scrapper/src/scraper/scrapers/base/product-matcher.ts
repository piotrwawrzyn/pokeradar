/**
 * Product matching utilities for fuzzy string comparison.
 */

import * as fuzz from 'fuzzball';
import { WatchlistProductInternal } from '../../../shared/types';
import { normalizeForMatching } from '../../../shared/utils/text-normalizer';

/**
 * Logger interface for product matching.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Product candidate from search results.
 */
export interface ProductCandidate {
  title: string;
  url: string;
  score: number;
  searchPageData?: {
    price: number | null;
    isAvailable: boolean;
  };
}

/**
 * Handles product title matching and validation.
 */
export class ProductMatcher {
  private readonly MIN_SCORE_THRESHOLD = 95;
  private readonly DIRECT_HIT_THRESHOLD = 90;

  constructor(private logger?: ILogger) {}

  /**
   * Validates a title against exclude list and returns fuzzy match score.
   * Returns null if title is excluded, otherwise returns the fuzzy score.
   */
  validateTitle(
    title: string,
    phrase: string,
    product: WatchlistProductInternal,
    shopId: string
  ): number | null {
    // Check exclude list
    if (product.search.exclude && product.search.exclude.length > 0) {
      const titleLower = title.toLowerCase();
      const isExcluded = product.search.exclude.some((word) =>
        titleLower.includes(word.toLowerCase())
      );
      if (isExcluded) {
        this.logger?.debug('Title contains excluded word', {
          shop: shopId,
          product: product.id,
          title,
          exclude: product.search.exclude,
        });
        return null;
      }
    }

    // Return fuzzy match score
    return fuzz.token_set_ratio(title, phrase);
  }

  /**
   * Checks if the extracted title matches the product name.
   */
  titleMatches(titleText: string | null, productName: string): boolean {
    if (!titleText) {
      return false;
    }

    const normalizedTitle = normalizeForMatching(titleText);
    const normalizedProduct = normalizeForMatching(productName);

    return normalizedTitle.includes(normalizedProduct);
  }

  /**
   * Selects the best matching product from candidates.
   * Returns the URL if a good match is found, null otherwise.
   */
  selectBestCandidate(
    candidates: ProductCandidate[],
    product: WatchlistProductInternal,
    phrase: string,
    shopId: string
  ): string | null {
    if (candidates.length === 0) {
      return null;
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    const bestMatch = candidates[0];

    // Check if score meets threshold
    if (bestMatch.score < this.MIN_SCORE_THRESHOLD) {
      this.logger?.warn('Best match score too low, product likely not in results', {
        shop: shopId,
        product: product.id,
        title: bestMatch.title,
        score: bestMatch.score,
        threshold: this.MIN_SCORE_THRESHOLD,
        phrase,
      });
      return null;
    }

    this.logger?.info('Found product match', {
      shop: shopId,
      product: product.id,
      title: bestMatch.title,
      score: bestMatch.score,
    });

    return bestMatch.url;
  }

  /**
   * Validates a direct hit score meets the threshold.
   */
  isValidDirectHitScore(score: number): boolean {
    return score >= this.DIRECT_HIT_THRESHOLD;
  }

  /**
   * Gets the direct hit threshold for logging purposes.
   */
  getDirectHitThreshold(): number {
    return this.DIRECT_HIT_THRESHOLD;
  }
}
