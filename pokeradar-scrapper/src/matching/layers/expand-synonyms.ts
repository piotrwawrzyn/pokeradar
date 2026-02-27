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

  // "Booster Display" → Booster Box (same product, different regional naming)
  { pattern: /\bbooster\s+display\b/g, replacement: 'booster box' },

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
 * Some shops zero-pad set numbers (e.g. "ME02", "ME03") while the DB stores
 * the unpadded form ("ME2", "ME3"). After normalisation both forms differ only
 * by a leading zero in the numeric suffix. This regex detects that structure:
 * one or more letters followed by one or more digits (with no leading zero).
 *
 * When a set number matches, the generated pattern uses `0?` before the digits
 * so it accepts both the unpadded form ("me2") and the zero-padded form ("me02").
 * Set numbers that already have a leading zero, contain dots, or have a more
 * complex structure are matched literally and are not affected.
 */
const LETTER_PREFIX_DIGIT_SUFFIX = /^([a-z]+)([1-9]\d*)$/;

/**
 * Returns a regex source string that matches the normalised set number and,
 * when the set number is a simple letter-prefix + unpadded-digit-suffix token
 * (e.g. "me2", "sv8"), also matches the zero-padded variant ("me02", "sv08").
 *
 * Examples:
 *   "me2"  → "me0?2"  (matches "me2" and "me02")
 *   "sv8"  → "sv0?8"  (matches "sv8" and "sv08")
 *   "sv3 5" → "sv3 5" (dot-containing set numbers normalise with a space; matched literally)
 *   "me2 5" → "me2 5" (literal — already complex)
 */
function setNumberPattern(normalizedSetNumber: string): string {
  const m = LETTER_PREFIX_DIGIT_SUFFIX.exec(normalizedSetNumber);
  if (m) {
    // Insert optional leading zero between the letter prefix and digit suffix
    return `${escapeRegex(m[1])}0?${escapeRegex(m[2])}`;
  }
  return escapeRegex(normalizedSetNumber);
}

/**
 * Builds a list of synonym rules from ProductSet data loaded at pipeline
 * construction time. Each set contributes up to two rules:
 * - One for its official set number (e.g. "sv8" / "sv08" → "surging sparks")
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
        pattern: new RegExp(`\\b${setNumberPattern(normalizedSetNumber)}\\b`, 'g'),
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
