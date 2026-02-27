/**
 * Product matching pipeline.
 *
 * Chains six layers sequentially:
 *   1. Expand Set Numbers:   raw title → raw title (set numbers replaced before normalization)
 *   2. Normalize:            raw title → NormalizedTitle
 *   3. Filter Non-English:   NormalizedTitle → NormalizedTitle (discard non-English products)
 *   4. Expand Synonyms:      NormalizedTitle → NormalizedTitle (product-type abbreviations expanded)
 *   5. Match Type:           NormalizedTitle → TypeMatchResult
 *   6. Match Set:            TypeMatchResult → MatchResult
 *
 * If layer 2, 3, 5, or 6 returns null the pipeline stops early.
 * Layers 1 and 4 never return null — they pass through unchanged when nothing matches.
 * Constructed once with reference data, reused for many titles.
 */

import { PipelineConfig, PipelineLogger, MatchResult } from './types';
import { ExpandSetNumbersLayer } from './layers/expand-set-numbers';
import { NormalizeLayer } from './layers/normalize';
import { FilterNonEnglishLayer } from './layers/filter-non-english';
import { ExpandSynonymsLayer } from './layers/expand-synonyms';
import { MatchProductTypeLayer } from './layers/match-product-type';
import { MatchProductSetLayer } from './layers/match-product-set';

export class ProductMatchingPipeline {
  private expandSetNumbersLayer: ExpandSetNumbersLayer;
  private normalizeLayer: NormalizeLayer;
  private filterNonEnglishLayer: FilterNonEnglishLayer;
  private expandSynonymsLayer: ExpandSynonymsLayer;
  private matchTypeLayer: MatchProductTypeLayer;
  private matchSetLayer: MatchProductSetLayer;

  constructor(config: PipelineConfig, logger?: PipelineLogger) {
    this.expandSetNumbersLayer = new ExpandSetNumbersLayer(config.productSets, logger);
    this.normalizeLayer = new NormalizeLayer();
    this.filterNonEnglishLayer = new FilterNonEnglishLayer();
    this.expandSynonymsLayer = new ExpandSynonymsLayer();
    this.matchTypeLayer = new MatchProductTypeLayer(config.productTypes, logger);
    this.matchSetLayer = new MatchProductSetLayer(config.productSets, logger);
  }

  /** Runs the full pipeline. Returns MatchResult on success, null on failure. */
  match(rawTitle: string): MatchResult | null {
    const withSetNumbers = this.expandSetNumbersLayer.execute({ rawTitle });

    const normalized = this.normalizeLayer.execute(withSetNumbers);
    if (!normalized) return null;

    const filtered = this.filterNonEnglishLayer.execute(normalized);
    if (!filtered) return null;

    const expanded = this.expandSynonymsLayer.execute(filtered);

    const typeMatch = this.matchTypeLayer.execute(expanded);
    if (!typeMatch) return null;

    return this.matchSetLayer.execute(typeMatch);
  }
}
