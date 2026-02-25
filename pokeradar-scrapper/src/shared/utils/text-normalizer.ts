/**
 * Text normalization utilities for matching and comparison.
 */

/**
 * Maps common abbreviations to their full forms.
 * Applied before token matching so ETB, BB etc. are treated as their full names.
 */
const ABBREVIATION_MAP: Record<string, string> = {
  etb: 'elite trainer box',
  bb: 'booster box',
  '3pk': '3 pack',
  '3-pack': '3 pack',
  '3pack': '3 pack',
  '2pk': '2 pack',
  '2-pack': '2 pack',
  '2pack': '2 pack',
  '9pk': '9 pack',
  '9-pack': '9 pack',
};

/**
 * Expands known abbreviations in a string to their full forms.
 * Matches whole words only (word-boundary aware).
 *
 * @example
 * expandAbbreviations("ETB Surging Sparks") // "elite trainer box Surging Sparks"
 * expandAbbreviations("3pk blister") // "3 pack blister"
 */
export function expandAbbreviations(text: string): string {
  let result = text;
  for (const [abbr, expansion] of Object.entries(ABBREVIATION_MAP)) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'gi'), expansion);
  }
  return result;
}

/**
 * Normalizes text for matching purposes.
 * - Expands abbreviations (ETB → elite trainer box, etc.)
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes various dash characters to hyphen
 * - Replaces dashes and colons with spaces
 * - Collapses multiple spaces
 */
export function normalizeForMatching(text: string): string {
  return expandAbbreviations(text)
    .toLowerCase()
    .trim()
    .replace(/[–—‐‑−]/g, '-') // Normalize various dashes to hyphen
    .replace(/[-:]+/g, ' ') // Replace dashes and colons with space
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Checks if normalized text contains normalized search term.
 */
export function normalizedIncludes(text: string, searchTerm: string): boolean {
  return normalizeForMatching(text).includes(normalizeForMatching(searchTerm));
}
