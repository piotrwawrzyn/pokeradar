/**
 * Layer 3: Product set matching.
 *
 * Matches the residual title (after type tokens removed) against known sets
 * using fuzzy token matching.
 *
 * Generic sets (where name === series) only match if no other set in the
 * same series matched. This prevents "Mega Evolution" (generic) from
 * stealing matches from "Phantasmal Flames" when both appear in a title.
 */

import * as fuzz from 'fuzzball';
import {
  PipelineLayer,
  TypeMatchResult,
  MatchResult,
  MatchableProductSet,
  PipelineLogger,
} from '../types';
import { normalizeTitle } from './normalize';

const SET_TOKEN_THRESHOLD = 85;
const SET_MATCH_MIN_SCORE = 85;

/** Pre-processed set for efficient matching. Built once at construction. */
interface ProcessedSet {
  set: MatchableProductSet;
  normalizedName: string;
  nameTokens: string[];
  isGeneric: boolean;
}

interface SetCandidate {
  processed: ProcessedSet;
  score: number;
}

export class MatchProductSetLayer implements PipelineLayer<TypeMatchResult, MatchResult> {
  readonly name = 'match-product-set';

  private processedSets: ProcessedSet[];

  constructor(
    productSets: MatchableProductSet[],
    private logger?: PipelineLogger,
  ) {
    this.processedSets = productSets.map((set) => {
      const normalizedName = normalizeTitle(set.name);
      return {
        set,
        normalizedName,
        nameTokens: tokenize(normalizedName),
        isGeneric: set.name === set.series,
      };
    });
  }

  execute(input: TypeMatchResult): MatchResult | null {
    const residualTokens = tokenize(input.residualTitle);

    if (residualTokens.length === 0) {
      this.logger?.debug('Empty residual title, cannot match set', {
        type: input.matchedType.id,
        title: input.title.normalized,
      });
      return null;
    }

    const candidates = this.findCandidates(residualTokens);
    if (candidates.length === 0) {
      this.logger?.debug('No product set matched', {
        residual: input.residualTitle,
        type: input.matchedType.id,
      });
      return null;
    }

    const filtered = this.applyGenericExclusion(candidates);
    if (filtered.length === 0) return null;

    if (filtered.length > 1) {
      this.logger?.warn('Multiple sets matched, dismissing', {
        residual: input.residualTitle,
        type: input.matchedType.id,
        sets: filtered.map((c) => ({ id: c.processed.set.id, score: c.score })),
      });
      // TODO: pick best by score or use additional heuristics
      return null;
    }

    const winner = filtered[0];
    return {
      title: input.title,
      productType: input.matchedType,
      productSet: winner.processed.set,
      typeMatchScore: input.typeMatchScore,
      setMatchScore: winner.score,
    };
  }

  // ── Private helpers ──

  /** Scores all sets against residual tokens and returns viable candidates. */
  private findCandidates(residualTokens: string[]): SetCandidate[] {
    const candidates: SetCandidate[] = [];

    for (const processed of this.processedSets) {
      const score = scoreSetMatch(processed.nameTokens, residualTokens);
      if (score !== null && score >= SET_MATCH_MIN_SCORE) {
        candidates.push({ processed, score });
      }
    }

    return candidates;
  }

  /**
   * Removes generic sets when a specific set in the same series also matched.
   * Generic set = set where name === series.
   */
  private applyGenericExclusion(candidates: SetCandidate[]): SetCandidate[] {
    const seriesWithSpecificMatch = new Set<string>();
    for (const c of candidates) {
      if (!c.processed.isGeneric) {
        seriesWithSpecificMatch.add(c.processed.set.series);
      }
    }

    return candidates.filter((c) => {
      if (c.processed.isGeneric && seriesWithSpecificMatch.has(c.processed.set.series)) {
        this.logger?.debug('Generic set excluded in favor of specific set', {
          genericSet: c.processed.set.name,
          series: c.processed.set.series,
        });
        return false;
      }
      return true;
    });
  }
}

// ── Pure utility functions ──

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * All set name tokens must appear in the residual (asymmetric containment).
 * Returns average score or null if any token is below threshold.
 */
function scoreSetMatch(setTokens: string[], residualTokens: string[]): number | null {
  if (setTokens.length === 0) return null;

  const scores: number[] = [];

  for (const setToken of setTokens) {
    const best = Math.max(...residualTokens.map((rt) => fuzz.ratio(setToken, rt)));
    if (best < SET_TOKEN_THRESHOLD) return null;
    scores.push(best);
  }

  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}
