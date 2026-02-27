/**
 * Layer 2: Synonym and abbreviation expansion.
 *
 * Expands common abbreviations and alternative product-type names into their
 * canonical forms before type and set matching occurs. This lets downstream
 * layers work with a consistent vocabulary regardless of how shop titles phrase
 * the same product.
 *
 * Two categories of expansion are applied, in order:
 *
 * 1. Product-type synonyms (hardcoded)
 *    Short abbreviations and Polish/alternative spellings are replaced with the
 *    canonical English token string. Replacements use word-boundary anchors so
 *    that e.g. "etb" is expanded but "etbx" is not.
 *
 * 2. Set identifiers (built from DB data at construction time)
 *    Official set numbers (e.g. "sv8") and three-letter set abbreviations
 *    (e.g. "ssp") are replaced with the normalised full set name
 *    (e.g. "surging sparks"). This avoids hard-coding set data in source code —
 *    it is read directly from the ProductSet documents loaded for the pipeline.
 *
 * This layer never returns null: if no expansion applies the input passes
 * through unchanged, which is the correct behaviour.
 */

import { PipelineLayer, NormalizedTitle, MatchableProductSet } from '../types';
import { normalizeTitle } from './normalize';

// ── Product-type synonym table ──
//
// Keys must be already-normalised (lowercase, ASCII, no special chars) since
// they are matched against the output of the normalize layer.
// Each tuple: [pattern, replacement]

/** A single synonym rule: a word-boundary regex and its canonical replacement. */
interface SynonymRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * Static product-type synonym rules.
 * Order is significant: rules are applied top-to-bottom. More specific rules
 * (multi-token patterns) should come before shorter ones where overlap is possible.
 */
const PRODUCT_TYPE_SYNONYM_RULES: SynonymRule[] = [
  // "ETB" → Elite Trainer Box
  { pattern: /\betb\b/g, replacement: 'elite trainer box' },

  // "BB" → Booster Box
  { pattern: /\bbb\b/g, replacement: 'booster box' },

  // "Checklane" (a specific blister format) → Blister
  { pattern: /\bchecklane\b/g, replacement: 'blister' },

  // "3PK", "Trójpak" (Polish) → 3 pack
  // Note: "3-Pack" is already handled by the normalize layer (dash → space) so
  // the expand layer only needs to cover the abbreviation forms.
  // Diacritics are also already stripped by normalize ("trojpak" not "trójpak").
  { pattern: /\b3pk\b|\btrojpak\b/g, replacement: '3 pack' },

  // "2PK" → 2 pack  ("2-Pack" is normalized to "2 pack" by the normalize layer)
  { pattern: /\b2pk\b/g, replacement: '2 pack' },

  // "Puszka" (Polish for tin/can) → Tin
  { pattern: /\bpuszka\b/g, replacement: 'tin' },

  // "Bundle (10)" — a 10-booster bundle sold as a display-style product → Display
  // Note: the normalize layer converts parentheses to spaces, so "(10)" becomes "10"
  { pattern: /\bbundle\s+10\b/g, replacement: 'display' },
];

// ── Set identifier expansion ──

/**
 * Builds a list of synonym rules from ProductSet data loaded at pipeline
 * construction time. Each set contributes up to two rules:
 * - One for its official set number (e.g. "sv8" → "surging sparks")
 * - One for its three-letter abbreviation (e.g. "ssp" → "surging sparks")
 *
 * Both keys and replacements are normalised via normalizeTitle() so that
 * matching is case-insensitive and diacritic-safe.
 */
function buildSetExpansionRules(productSets: MatchableProductSet[]): SynonymRule[] {
  const rules: SynonymRule[] = [];

  for (const set of productSets) {
    const normalizedName = normalizeTitle(set.name);
    if (!normalizedName) continue;

    const normalizedSetNumber = normalizeTitle(set.setNumber);
    if (normalizedSetNumber) {
      rules.push({
        pattern: new RegExp(`\\b${escapeRegex(normalizedSetNumber)}\\b`, 'g'),
        replacement: normalizedName,
      });
    }

    const normalizedAbbreviation = normalizeTitle(set.setAbbreviation);
    if (normalizedAbbreviation) {
      rules.push({
        pattern: new RegExp(`\\b${escapeRegex(normalizedAbbreviation)}\\b`, 'g'),
        replacement: normalizedName,
      });
    }
  }

  return rules;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Layer implementation ──

export class ExpandSynonymsLayer implements PipelineLayer<NormalizedTitle, NormalizedTitle> {
  readonly name = 'expand-synonyms';

  private setExpansionRules: SynonymRule[];

  constructor(
    productSets: MatchableProductSet[],
    private logger?: { debug(message: string, meta?: Record<string, unknown>): void },
  ) {
    this.setExpansionRules = buildSetExpansionRules(productSets);
  }

  execute(input: NormalizedTitle): NormalizedTitle {
    let expanded = input.normalized;

    // Apply product-type synonyms first (static, always checked)
    for (const rule of PRODUCT_TYPE_SYNONYM_RULES) {
      expanded = expanded.replace(rule.pattern, rule.replacement);
    }

    // Apply set identifier expansions (dynamic, from DB data)
    for (const rule of this.setExpansionRules) {
      expanded = expanded.replace(rule.pattern, rule.replacement);
    }

    // Collapse any extra whitespace that replacements may have introduced
    expanded = expanded.replace(/\s+/g, ' ').trim();

    if (expanded !== input.normalized) {
      this.logger?.debug('Synonym expansion applied', {
        original: input.normalized,
        expanded,
      });
    }

    return { raw: input.raw, normalized: expanded };
  }
}
