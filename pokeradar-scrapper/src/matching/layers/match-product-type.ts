/**
 * Layer 2: Product type matching (containment-tree-sorted).
 *
 * Matches a normalized title against product types using fuzzy token matching.
 * Types are sorted by their depth in the containment tree, deepest first:
 *
 *   depth = maximum number of ancestor steps to a root type
 *
 * Example tree:
 *   Mini Tin Display → Mini Tin → Booster   (depths 2, 1, 0)
 *   Booster Box      → Booster              (depths 1, 0)
 *
 * Sort order: depth 2 first, then depth 1, then depth 0. Within the same
 * depth, more required tokens (more specific) comes first; alphabetical name
 * as the final tiebreak.
 *
 * This guarantees "Mini Tin Display" is tried before "Mini Tin" before
 * "Booster", regardless of token counts. First match wins.
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
  /**
   * Maximum containment depth: 0 for root types (not contained by anything),
   * 1 for direct ingredients of a root, 2 for ingredients of depth-1 types, etc.
   * Used as the primary sort key — deepest types are tried first.
   */
  depth: number;
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
   * Pre-processes and sorts types by containment-tree depth (deepest first),
   * then by required token count (most specific first), then alphabetically.
   * See `computeContainmentDepths` for depth semantics.
   */
  private buildSortedTypes(types: MatchableProductType[]): ProcessedType[] {
    const depths = computeContainmentDepths(types);

    const processed = types.map((type) => ({
      type,
      requiredTokens: flattenTokens(type.matchingProfile.required),
      forbiddenTokens: flattenTokens(type.matchingProfile.forbidden),
      depth: depths.get(type.id) ?? 0,
    }));

    return processed.sort((a, b) => {
      // 1. Deeper types (further from root) first
      if (b.depth !== a.depth) return b.depth - a.depth;
      // 2. More specific (more required tokens) first
      const diff = b.requiredTokens.length - a.requiredTokens.length;
      if (diff !== 0) return diff;
      // 3. Alphabetical tiebreak
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

/**
 * Computes, for each product type, the length of the longest downward path
 * in the `contains` DAG starting from that type.
 *
 * Leaf types (contain nothing) have depth 0. A type that contains a leaf has
 * depth 1, a type that contains a depth-1 type has depth 2, and so on.
 *
 * Example:
 *   Mini Tin Display → Mini Tin → Booster: depths 2, 1, 0
 *   Booster Box → Booster:                 depths 1, 0
 *
 * Deeper types are tried first, so containers beat their ingredients.
 * Computed via memoised DFS; cycles are guarded and treated as depth 0.
 */
function computeContainmentDepths(types: MatchableProductType[]): Map<string, number> {
  const typeMap = new Map<string, MatchableProductType>();
  for (const t of types) typeMap.set(t.id, t);

  const depths = new Map<string, number>();

  function depth(id: string, visiting: Set<string>): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard

    const type = typeMap.get(id);
    if (!type || type.contains.length === 0) {
      depths.set(id, 0);
      return 0;
    }

    visiting.add(id);
    const maxChildDepth = Math.max(...type.contains.map((childId) => depth(childId, visiting)));
    visiting.delete(id);

    const d = maxChildDepth + 1;
    depths.set(id, d);
    return d;
  }

  for (const type of types) {
    depth(type.id, new Set());
  }

  return depths;
}

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
