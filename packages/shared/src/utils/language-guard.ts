/**
 * Language guard for product title filtering.
 * Blocks non-English product titles (Japanese, Korean, Chinese).
 * Applied globally before per-product matching — not per-product config.
 */

const LANGUAGE_TOKENS = new Set([
  'japan',
  'japanese',
  'japonski',
  'japonska',
  'japoński',
  'japońska',
  'korea',
  'korean',
  'koreanski',
  'koreański',
  'chinese',
  'chinski',
  'chiński',
]);

// Short tokens that must appear as standalone words (not substrings of longer words)
const STANDALONE_TOKENS = new Set(['jp', 'kr', 'cn']);

/**
 * Returns true if the title indicates a non-English product that should be filtered out.
 *
 * @example
 * isLanguageFiltered("Pokemon Booster Box (japoński)") // true
 * isLanguageFiltered("Phantasmal Flames Booster JP") // true
 * isLanguageFiltered("Surging Sparks Booster Box") // false
 */
export function isLanguageFiltered(title: string): boolean {
  const lower = title.toLowerCase();

  for (const token of LANGUAGE_TOKENS) {
    if (lower.includes(token)) return true;
  }

  for (const token of STANDALONE_TOKENS) {
    if (new RegExp(`(?<![a-z])${token}(?![a-z])`).test(lower)) return true;
  }

  return false;
}
