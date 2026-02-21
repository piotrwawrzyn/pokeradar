/**
 * Candidate Selection Strategy
 *
 * Ranks product candidates when multiple items match a search phrase.
 * Selection priority:
 *   1. Availability — prefer in-stock over unknown over out-of-stock
 *   2. Price — prefer cheapest (unknown price ranks last)
 *   3. Fuzzy score — highest match score as tiebreaker
 *
 * When no searchPageData is present (shop doesn't expose price/availability
 * on search results), all candidates tie on availability and price,
 * so selection falls back to score — matching the previous behavior.
 */

import { ProductCandidate } from '../product-matcher';

/** Availability tiers: lower = better */
enum AvailabilityTier {
  Available = 0,
  Unknown = 1,
  Unavailable = 2,
}

/**
 * Returns the availability tier for a candidate.
 *   - Has searchPageData + available → Available (best)
 *   - No searchPageData → Unknown (neutral)
 *   - Has searchPageData + unavailable → Unavailable (worst)
 */
function getAvailabilityTier(candidate: ProductCandidate): AvailabilityTier {
  if (!candidate.searchPageData) return AvailabilityTier.Unknown;
  return candidate.searchPageData.isAvailable
    ? AvailabilityTier.Available
    : AvailabilityTier.Unavailable;
}

/**
 * Compares two candidates for sorting.
 * Returns negative if `a` should rank higher (be selected), positive if `b`.
 *
 * Priority: availability tier → price (ascending) → score (descending)
 */
function compareCandidates(a: ProductCandidate, b: ProductCandidate): number {
  // 1. Availability: available > unknown > unavailable
  const availDiff = getAvailabilityTier(a) - getAvailabilityTier(b);
  if (availDiff !== 0) return availDiff;

  // 2. Price: cheapest first (null/missing price treated as Infinity)
  const priceA = a.searchPageData?.price ?? Infinity;
  const priceB = b.searchPageData?.price ?? Infinity;
  if (priceA !== priceB) return priceA - priceB;

  // 3. Score: highest first (tiebreaker)
  return b.score - a.score;
}

/**
 * Selects the best candidate from a list of viable (above-threshold) candidates.
 * Returns the winning candidate, or null if the list is empty.
 */
export function selectBestCandidate(candidates: ProductCandidate[]): ProductCandidate | null {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort(compareCandidates);
  return sorted[0];
}
