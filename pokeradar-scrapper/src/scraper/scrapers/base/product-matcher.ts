/**
 * Product matching utilities for fuzzy string comparison.
 */

import * as fuzz from 'fuzzball';
import { WatchlistProductInternal } from '../../../shared/types';
import { normalizeForMatching } from '../../../shared/utils/text-normalizer';
import { selectBestCandidate as rankCandidates } from './helpers/candidate-selector';

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
    if (product.search?.exclude && product.search?.exclude.length > 0) {
      const titleLower = title.toLowerCase();
      // Use negative lookbehind/lookahead instead of simple .includes() to avoid
      // false positives where an exclude word appears as a substring of another word.
      // e.g. "tin" (exclude for Mini Tin) would incorrectly block "Destined Rivals"
      // because "destined" contains "tin" as a substring.
      const isExcluded = product.search?.exclude.some((word) =>
        new RegExp(`(?<![a-z])${word.toLowerCase()}(?![a-z])`).test(titleLower)
      );
      if (isExcluded) {
        this.logger?.debug('Title contains excluded word', {
          shop: shopId,
          product: product.id,
          title,
          exclude: product.search?.exclude,
        });
        return null;
      }
    }

    // Asymmetric containment: all phrase tokens must exist in title (extra title tokens are OK)
    // Uses fuzzy matching per token so variations like "Boosters"/"Booster" still match
    // Score = average of best per-token match ratios
    const phraseTokens = phrase.toLowerCase().split(/\W+/).filter(Boolean);
    const titleTokenArr = title.toLowerCase().split(/\W+/).filter(Boolean);

    const TOKEN_THRESHOLD = 85;
    const tokenScores = phraseTokens.map((pt) => {
      const bestMatch = Math.max(...titleTokenArr.map((tt) => fuzz.ratio(pt, tt)));
      return bestMatch;
    });

    const missingTokens = phraseTokens.filter(
      (_, i) => tokenScores[i] < TOKEN_THRESHOLD
    );

    if (missingTokens.length > 0) {
      this.logger?.debug('Title missing phrase tokens', {
        shop: shopId,
        product: product.id,
        title,
        phrase,
        missingTokens,
      });
      return null;
    }

    // Score = average of best per-token fuzzy matches
    return Math.round(tokenScores.reduce((sum, s) => sum + s, 0) / tokenScores.length);
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
    if (candidates.length === 0) return null;

    const viable = candidates.filter((c) => c.score >= this.MIN_SCORE_THRESHOLD);

    if (viable.length === 0) {
      const best = candidates.sort((a, b) => b.score - a.score)[0];
      this.logger?.warn('Best match score too low, product likely not in results', {
        shop: shopId,
        product: product.id,
        title: best.title,
        score: best.score,
        threshold: this.MIN_SCORE_THRESHOLD,
        phrase,
      });
      return null;
    }

    const bestMatch = rankCandidates(viable)!;

    this.logger?.debug('Found product match', {
      shop: shopId,
      product: product.id,
      title: bestMatch.title,
      score: bestMatch.score,
      price: bestMatch.searchPageData?.price ?? null,
      isAvailable: bestMatch.searchPageData?.isAvailable ?? null,
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
