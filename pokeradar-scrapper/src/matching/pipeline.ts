/**
 * Product matching pipeline.
 *
 * Chains three layers sequentially:
 *   1. Normalize: raw title → NormalizedTitle
 *   2. Match Product Type: NormalizedTitle → TypeMatchResult
 *   3. Match Product Set: TypeMatchResult → MatchResult
 *
 * If any layer returns null the pipeline stops early.
 * Constructed once with reference data, reused for many titles.
 */

import { PipelineConfig, PipelineLogger, MatchResult } from './types';
import { NormalizeLayer } from './layers/normalize';
import { MatchProductTypeLayer } from './layers/match-product-type';
import { MatchProductSetLayer } from './layers/match-product-set';

export class ProductMatchingPipeline {
  private normalizeLayer: NormalizeLayer;
  private matchTypeLayer: MatchProductTypeLayer;
  private matchSetLayer: MatchProductSetLayer;

  constructor(config: PipelineConfig, logger?: PipelineLogger) {
    this.normalizeLayer = new NormalizeLayer();
    this.matchTypeLayer = new MatchProductTypeLayer(config.productTypes, logger);
    this.matchSetLayer = new MatchProductSetLayer(config.productSets, logger);
  }

  /** Runs the full pipeline. Returns MatchResult on success, null on failure. */
  match(rawTitle: string): MatchResult | null {
    const normalized = this.normalizeLayer.execute({ rawTitle });
    if (!normalized) return null;

    const typeMatch = this.matchTypeLayer.execute(normalized);
    if (!typeMatch) return null;

    return this.matchSetLayer.execute(typeMatch);
  }
}
