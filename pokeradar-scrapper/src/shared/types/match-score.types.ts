/**
 * Structured match score and confidence bands for product title matching.
 */

export type MatchBand = 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED';

export interface MatchScore {
  /** 0-100: how well the required tokens matched */
  requiredTokenScore: number;
  /** Number of forbidden token violations (0 = clean) */
  forbiddenViolations: number;
  /** 0-100: how well the set name matched in the title */
  setNameScore: number;
  /** 0-100: combined confidence */
  overallConfidence: number;
  matchBand: MatchBand;
}

export const BAND_THRESHOLDS = {
  HIGH: 90,
  MEDIUM_MIN: 65,
} as const;
