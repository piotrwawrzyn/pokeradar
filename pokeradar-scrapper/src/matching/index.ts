/**
 * Product matching pipeline — public API.
 *
 * Usage:
 *   const pipeline = new ProductMatchingPipeline({ productTypes, productSets });
 *   const result = pipeline.match("Pokemon TCG Surging Sparks Booster Box PL");
 *   // => { productType, productSet, ... } or null
 */

export { ProductMatchingPipeline } from './pipeline';
export { normalizeTitle } from './layers/normalize';
export type {
  MatchResult,
  PipelineConfig,
  PipelineInput,
  NormalizedTitle,
  TypeMatchResult,
  MatchableProductType,
  MatchableProductSet,
  PipelineLogger,
  PipelineLayer,
} from './types';
