/**
 * Layer 2: Product type matching (specificity-sorted).
 *
 * Matches a normalized title against product types using fuzzy token matching.
 * Types are sorted by required token count descending — most specific first.
 * First match wins. This ensures "Booster Box" (2 tokens) is tried before
 * "Booster" (1 token).
 */

import * as fuzz from 'fuzzball';
import {
  PipelineLayer,
  NormalizedTitle,
  TypeMatchResult,
  MatchableProductType,
  PipelineLogger,
} from '../types';
import { normalizeTitle } from './normalize';

const TOKEN_THRESHOLD = 90;

/** Pre-processed type for efficient matching. Built once at construction. */
interface ProcessedType {
  type: MatchableProductType;
  requiredTokens: string[];
  forbiddenTokens: string[];
}

export class MatchProductTypeLayer implements PipelineLayer<NormalizedTitle, TypeMatchResult> {
  readonly name = 'match-product-type';

  private sortedTypes: ProcessedType[];

  constructor(
    productTypes: MatchableProductType[],
    private logger?: PipelineLogger,
  ) {
    this.sortedTypes = this.buildSortedTypes(productTypes);
  }

  execute(input: NormalizedTitle): TypeMatchResult | null {
    const titleTokens = tokenize(input.normalized);

    for (const processed of this.sortedTypes) {
      const score = this.scoreMatch(processed, titleTokens, input.normalized);
      if (score === null) continue;

      const residual = buildResidualTitle(input.normalized, processed.requiredTokens);

      return {
        title: input,
        matchedType: processed.type,
        residualTitle: residual,
        typeMatchScore: score,
      };
    }

    this.logger?.debug('No product type matched', { title: input.normalized });
    return null;
  }

  // ── Construction helpers ──

  /**
   * Pre-processes and sorts types by specificity (most tokens first).
   * Defensively splits multi-word tokens and lowercases.
   */
  private buildSortedTypes(types: MatchableProductType[]): ProcessedType[] {
    const processed = types.map((type) => ({
      type,
      requiredTokens: flattenTokens(type.matchingProfile.required),
      forbiddenTokens: flattenTokens(type.matchingProfile.forbidden),
    }));

    return processed.sort((a, b) => {
      const diff = b.requiredTokens.length - a.requiredTokens.length;
      if (diff !== 0) return diff;
      return a.type.name.localeCompare(b.type.name);
    });
  }

  // ── Matching helpers ──

  /**
   * Scores a type against title tokens.
   * Returns average fuzzy score or null if forbidden token found or any required token missing.
   */
  private scoreMatch(
    processed: ProcessedType,
    titleTokens: string[],
    normalizedTitle: string,
  ): number | null {
    if (processed.requiredTokens.length === 0) return null;

    if (hasForbiddenToken(processed.forbiddenTokens, normalizedTitle)) {
      return null;
    }

    return scoreRequiredTokens(processed.requiredTokens, titleTokens);
  }
}

// ── Pure utility functions ──

/** Splits token strings on whitespace and lowercases. */
function flattenTokens(tokens: string[]): string[] {
  return tokens.flatMap((t) => normalizeTitle(t).split(/\s+/).filter(Boolean));
}

/** Splits a string into non-empty tokens. */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Checks if any forbidden token appears in the title (word-boundary aware). */
function hasForbiddenToken(forbidden: string[], normalizedTitle: string): boolean {
  return forbidden.some((token) =>
    new RegExp(`(?<![a-z])${escapeRegex(token)}(?![a-z])`).test(normalizedTitle),
  );
}

/**
 * Fuzzy-matches each required token against title tokens.
 * Returns average score or null if any token is below threshold.
 */
function scoreRequiredTokens(required: string[], titleTokens: string[]): number | null {
  const scores: number[] = [];

  for (const reqToken of required) {
    const best = Math.max(...titleTokens.map((tt) => fuzz.ratio(reqToken, tt)));
    if (best < TOKEN_THRESHOLD) return null;
    scores.push(best);
  }

  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/**
 * Builds a residual title by removing tokens that matched required type tokens.
 * The residual is passed to Layer 3 for set name matching.
 */
function buildResidualTitle(normalizedTitle: string, requiredTokens: string[]): string {
  let residual = normalizedTitle;
  for (const token of requiredTokens) {
    residual = residual.replace(new RegExp(`(?<![a-z])${escapeRegex(token)}(?![a-z])`, 'g'), ' ');
  }
  return residual.replace(/\s+/g, ' ').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
