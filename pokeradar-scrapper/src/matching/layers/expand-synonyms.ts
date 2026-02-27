/**
 * Layer 3: Product-type synonym expansion (post-normalization).
 *
 * Expands common abbreviations and alternative product-type names into their
 * canonical forms after normalization. This lets downstream layers work with a
 * consistent vocabulary regardless of how shop titles phrase the same product.
 *
 * Set number expansion is handled by the earlier ExpandSetNumbersLayer (pre-
 * normalization), which can match raw set numbers like "SV3.5" and "ME02.5"
 * literally before the dot and zero-padding are transformed by normalization.
 *
 * This layer never returns null: if no expansion applies the input passes
 * through unchanged, which is the correct behaviour.
 */

import { PipelineLayer, NormalizedTitle } from '../types';

/** A single synonym rule: a word-boundary regex and its canonical replacement. */
interface SynonymRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * Static product-type synonym rules.
 * Order is significant: rules are applied top-to-bottom. More specific rules
 * (multi-token patterns) should come before shorter ones where overlap is possible.
 * All patterns match against already-normalised (lowercase, ASCII) text.
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

  // "Mini Tin box (10)" / "Mini Tin 10 szt." — a display of 10 mini tins.
  // After normalization: "mini tin box 10 ..." / "mini tin 10 szt ..." → "mini tin display ..."
  // Replaces "mini tin" + optional "box" + the quantity "10", leaving any trailing tokens intact.
  { pattern: /\bmini\s+tin(?:\s+box)?\s+10\b/g, replacement: 'mini tin display' },
];

// ── Layer implementation ──

export class ExpandSynonymsLayer implements PipelineLayer<NormalizedTitle, NormalizedTitle> {
  readonly name = 'expand-synonyms';

  execute(input: NormalizedTitle): NormalizedTitle {
    let expanded = input.normalized;

    for (const rule of PRODUCT_TYPE_SYNONYM_RULES) {
      expanded = expanded.replace(rule.pattern, rule.replacement);
    }

    // Collapse any extra whitespace that replacements may have introduced
    expanded = expanded.replace(/\s+/g, ' ').trim();

    return { raw: input.raw, normalized: expanded };
  }
}
