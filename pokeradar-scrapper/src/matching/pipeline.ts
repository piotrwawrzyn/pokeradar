/**
 * Product matching pipeline.
 *
 * Chains four layers sequentially:
 *   1. Normalize:        raw title → NormalizedTitle
 *   2. Expand Synonyms: NormalizedTitle → NormalizedTitle (abbreviations expanded)
 *   3. Match Type:      NormalizedTitle → TypeMatchResult
 *   4. Match Set:       TypeMatchResult → MatchResult
 *
 * If layer 1 or 3 or 4 returns null the pipeline stops early.
 * Layer 2 never returns null — it passes through unchanged when nothing matches.
 * Constructed once with reference data, reused for many titles.
 */

import { PipelineConfig, PipelineLogger, MatchResult } from './types';
import { NormalizeLayer } from './layers/normalize';
import { ExpandSynonymsLayer } from './layers/expand-synonyms';
import { MatchProductTypeLayer } from './layers/match-product-type';
import { MatchProductSetLayer } from './layers/match-product-set';

export class ProductMatchingPipeline {
  private normalizeLayer: NormalizeLayer;
  private expandSynonymsLayer: ExpandSynonymsLayer;
  private matchTypeLayer: MatchProductTypeLayer;
  private matchSetLayer: MatchProductSetLayer;

  constructor(config: PipelineConfig, logger?: PipelineLogger) {
    this.normalizeLayer = new NormalizeLayer();
    this.expandSynonymsLayer = new ExpandSynonymsLayer(config.productSets, logger);
    this.matchTypeLayer = new MatchProductTypeLayer(config.productTypes, logger);
    this.matchSetLayer = new MatchProductSetLayer(config.productSets, logger);
  }

  /** Runs the full pipeline. Returns MatchResult on success, null on failure. */
  match(rawTitle: string): MatchResult | null {
    const normalized = this.normalizeLayer.execute({ rawTitle });
    if (!normalized) return null;

    const expanded = this.expandSynonymsLayer.execute(normalized);

    const typeMatch = this.matchTypeLayer.execute(expanded);
    if (!typeMatch) return null;

    return this.matchSetLayer.execute(typeMatch);
  }
}
