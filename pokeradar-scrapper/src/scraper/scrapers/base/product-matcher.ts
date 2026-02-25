/**
 * Product matching utilities for fuzzy string comparison.
 * Emits structured match events (rejection, confirmation, pending) via MatchEventRepository.
 */

import * as fuzz from 'fuzzball';
import { ResolvedWatchlistProduct, BAND_THRESHOLDS, MatchBand } from '../../../shared/types';
import { normalizeForMatching } from '../../../shared/utils/text-normalizer';
import { selectBestCandidate as rankCandidates } from './helpers/candidate-selector';
import { MatchEventRepository } from '../../../shared/repositories/mongo/match-event.repository';
import { MLClassifierClient } from '../../../shared/clients/ml-classifier-client';

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
 * Emits match events fire-and-forget via MatchEventRepository.
 */
export class ProductMatcher {
  private readonly MIN_SCORE_THRESHOLD = 95;
  private readonly DIRECT_HIT_THRESHOLD = 90;

  constructor(
    private logger?: ILogger,
    private eventRepo?: MatchEventRepository,
    private mlClient?: MLClassifierClient,
  ) {}

  /**
   * Validates a title against exclude list and returns fuzzy match score.
   * Emits a rejection event if the title is excluded or missing required tokens.
   * Returns null if rejected, otherwise returns the fuzzy score (0-100).
   */
  validateTitle(
    title: string,
    phrase: string,
    product: ResolvedWatchlistProduct,
    shopId: string,
  ): number | null {
    // Check exclude list
    if (product.search.exclude.length > 0) {
      const titleLower = title.toLowerCase();
      // Use word-boundary regex to avoid substring false positives
      // e.g. "tin" should not block "destined" (contains "tin")
      const violatingWord = product.search.exclude.find((word: string) =>
        new RegExp(`(?<![a-z])${word.toLowerCase()}(?![a-z])`).test(titleLower),
      );
      if (violatingWord) {
        this.logger?.debug('Title contains excluded word', {
          shop: shopId,
          product: product.id,
          title,
          excludedWord: violatingWord,
        });
        this.eventRepo?.recordRejection({
          rawTitle: title,
          shopId,
          productId: product.id,
          phrase,
          reason: 'EXCLUDE_MATCH',
          details: `excluded word: "${violatingWord}"`,
        });
        return null;
      }
    }

    // Asymmetric containment: all phrase tokens must exist in title (extra title tokens are OK)
    // Uses fuzzy matching per token so variations like "Boosters"/"Booster" still match
    const phraseTokens = phrase.toLowerCase().split(/\W+/).filter(Boolean);
    const titleTokenArr = title.toLowerCase().split(/\W+/).filter(Boolean);

    const TOKEN_THRESHOLD = 90;
    const tokenScores = phraseTokens.map((pt) => {
      const bestMatch = Math.max(...titleTokenArr.map((tt) => fuzz.ratio(pt, tt)));
      return bestMatch;
    });

    const missingTokens = phraseTokens.filter((_, i) => tokenScores[i] < TOKEN_THRESHOLD);

    if (missingTokens.length > 0) {
      this.logger?.debug('Title missing phrase tokens', {
        shop: shopId,
        product: product.id,
        title,
        phrase,
        missingTokens,
      });
      this.eventRepo?.recordRejection({
        rawTitle: title,
        shopId,
        productId: product.id,
        phrase,
        reason: 'MISSING_TOKEN',
        details: `missing: [${missingTokens.join(', ')}]`,
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
   * Emits confirmation (HIGH) or pending (MEDIUM) events based on score band.
   * When no rule-engine candidate meets the threshold and an ML client is present,
   * falls back to ML classification and queues a PendingMatch for admin review.
   * Returns the URL if a good match is found, null otherwise.
   */
  selectBestCandidate(
    candidates: ProductCandidate[],
    product: ResolvedWatchlistProduct,
    phrase: string,
    shopId: string,
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
      this.eventRepo?.recordRejection({
        rawTitle: best.title,
        shopId,
        productId: product.id,
        phrase,
        reason: 'SCORE_TOO_LOW',
        details: `score: ${best.score}, threshold: ${this.MIN_SCORE_THRESHOLD}`,
      });

      // ML fallback: classify the best-scoring candidate title
      // Runs async fire-and-forget — does not block the scrape cycle
      if (this.mlClient) {
        this.runMlFallback(best.title, product.id, phrase, shopId);
      }

      return null;
    }

    const bestMatch = rankCandidates(viable)!;
    const band = this.scoreToBand(bestMatch.score);

    this.logger?.debug('Found product match', {
      shop: shopId,
      product: product.id,
      title: bestMatch.title,
      score: bestMatch.score,
      band,
      price: bestMatch.searchPageData?.price ?? null,
      isAvailable: bestMatch.searchPageData?.isAvailable ?? null,
    });

    if (band === 'HIGH') {
      this.eventRepo?.recordConfirmation({
        rawTitle: bestMatch.title,
        shopId,
        productId: product.id,
        matchBand: 'HIGH',
        source: 'AUTO_HIGH',
      });
    } else if (band === 'MEDIUM') {
      this.eventRepo?.recordPendingMatch({
        rawTitle: bestMatch.title,
        shopId,
        productId: product.id,
        confidence: bestMatch.score,
        phrase,
        source: 'AUTO_MEDIUM',
      });
    }

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

  /**
   * Async ML fallback — called fire-and-forget when rule engine finds no match.
   * If ML confidence meets threshold, creates a PendingMatch (AUTO_ML) for admin review.
   * Never auto-confirms ML results; always routes to admin queue.
   */
  private runMlFallback(rawTitle: string, productId: string, phrase: string, shopId: string): void {
    Promise.resolve().then(async () => {
      try {
        const result = await this.mlClient!.classify(rawTitle);
        if (!result || result.productId === null) return;

        this.logger?.info('ML fallback: queuing for admin review', {
          shop: shopId,
          title: rawTitle,
          mlProductId: result.productId,
          confidence: result.confidence,
        });

        this.eventRepo?.recordPendingMatch({
          rawTitle,
          shopId,
          productId: result.productId,
          confidence: result.confidence,
          phrase,
          source: 'AUTO_ML',
        });
      } catch {
        // Silently swallow — ML failures must not affect scrape results
      }
    });
  }

  private scoreToBand(score: number): MatchBand {
    if (score >= BAND_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= BAND_THRESHOLDS.MEDIUM_MIN) return 'MEDIUM';
    return 'LOW';
  }
}
