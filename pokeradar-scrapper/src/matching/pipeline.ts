/**
 * Product matching pipeline.
 *
 * Chains five layers sequentially:
 *   1. Expand Set Numbers: raw title → raw title (set numbers replaced before normalization)
 *   2. Normalize:          raw title → NormalizedTitle
 *   3. Expand Synonyms:    NormalizedTitle → NormalizedTitle (product-type abbreviations expanded)
 *   4. Match Type:         NormalizedTitle → TypeMatchResult
 *   5. Match Set:          TypeMatchResult → MatchResult
 *
 * If layer 2, 4, or 5 returns null the pipeline stops early.
 * Layers 1 and 3 never return null — they pass through unchanged when nothing matches.
 * Constructed once with reference data, reused for many titles.
 */

import { PipelineConfig, PipelineLogger, MatchResult } from './types';
import { ExpandSetNumbersLayer } from './layers/expand-set-numbers';
import { NormalizeLayer } from './layers/normalize';
import { ExpandSynonymsLayer } from './layers/expand-synonyms';
import { MatchProductTypeLayer } from './layers/match-product-type';
import { MatchProductSetLayer } from './layers/match-product-set';

export class ProductMatchingPipeline {
  private expandSetNumbersLayer: ExpandSetNumbersLayer;
  private normalizeLayer: NormalizeLayer;
  private expandSynonymsLayer: ExpandSynonymsLayer;
  private matchTypeLayer: MatchProductTypeLayer;
  private matchSetLayer: MatchProductSetLayer;

  constructor(config: PipelineConfig, logger?: PipelineLogger) {
    this.expandSetNumbersLayer = new ExpandSetNumbersLayer(config.productSets, logger);
    this.normalizeLayer = new NormalizeLayer();
    this.expandSynonymsLayer = new ExpandSynonymsLayer();
    this.matchTypeLayer = new MatchProductTypeLayer(config.productTypes, logger);
    this.matchSetLayer = new MatchProductSetLayer(config.productSets, logger);
  }

  /** Runs the full pipeline. Returns MatchResult on success, null on failure. */
  match(rawTitle: string): MatchResult | null {
    const withSetNumbers = this.expandSetNumbersLayer.execute({ rawTitle });

    const normalized = this.normalizeLayer.execute(withSetNumbers);
    if (!normalized) return null;

    const expanded = this.expandSynonymsLayer.execute(normalized);

    const typeMatch = this.matchTypeLayer.execute(expanded);
    if (!typeMatch) return null;

    return this.matchSetLayer.execute(typeMatch);
  }
}
