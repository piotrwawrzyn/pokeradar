/**
 * Product matching pipeline types.
 *
 * Defines the data flowing between pipeline layers and the public API.
 * Each layer transforms one type into the next; null means "no match."
 */

// ── Reference data (loaded from DB, passed at pipeline construction) ──

/** Product type used as pipeline reference data. */
export interface MatchableProductType {
  id: string;
  name: string;
  matchingProfile: {
    required: string[];
    forbidden: string[];
  };
}

/** Product set used as pipeline reference data. */
export interface MatchableProductSet {
  id: string;
  name: string;
  series: string;
}

// ── Data flowing through the pipeline ──

/** Input to the pipeline. */
export interface PipelineInput {
  rawTitle: string;
}

/** Output of Layer 1 (normalization). */
export interface NormalizedTitle {
  raw: string;
  normalized: string;
}

/** Output of Layer 2 (product type matching). */
export interface TypeMatchResult {
  title: NormalizedTitle;
  matchedType: MatchableProductType;
  residualTitle: string;
  typeMatchScore: number;
}

/** Output of Layer 3 (product set matching). Final pipeline result. */
export interface MatchResult {
  title: NormalizedTitle;
  productType: MatchableProductType;
  productSet: MatchableProductSet;
  typeMatchScore: number;
  setMatchScore: number;
}

// ── Pipeline layer interface ──

/** Generic pipeline layer. Returns TOut on match, null on failure. */
export interface PipelineLayer<TIn, TOut> {
  readonly name: string;
  execute(input: TIn): TOut | null;
}

// ── Pipeline configuration ──

/** Reference data passed to the pipeline at construction. */
export interface PipelineConfig {
  productTypes: MatchableProductType[];
  productSets: MatchableProductSet[];
}

/** Optional logger for pipeline operations. */
export interface PipelineLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}
