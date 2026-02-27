/**
 * Layer 1: Title normalization.
 *
 * Transforms raw scraped titles into a canonical form for matching:
 * 1. Lowercase
 * 2. Trim + collapse whitespace
 * 3. Replace Polish/special characters with ASCII equivalents
 * 4. Normalize dash variants, colons, ampersands, slashes, and plus signs to spaces
 */

import { PipelineLayer, PipelineInput, NormalizedTitle } from '../types';

const CHAR_MAP: Record<string, string> = {
  // Polish
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  // German
  ä: 'a',
  ö: 'o',
  ü: 'u',
  ß: 'ss',
  // French / common diacritics
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  à: 'a',
  â: 'a',
  î: 'i',
  ï: 'i',
  ô: 'o',
  û: 'u',
  ù: 'u',
  ç: 'c',
  ñ: 'n',
};

const CHAR_REGEX = new RegExp(`[${Object.keys(CHAR_MAP).join('')}]`, 'g');

/** Normalizes a title to a canonical lowercase ASCII form. */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(CHAR_REGEX, (ch) => CHAR_MAP[ch] || ch)
    .replace(/[–—‐‑−]/g, '-')
    .replace(/[-:&/+()\[\]{}]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class NormalizeLayer implements PipelineLayer<PipelineInput, NormalizedTitle> {
  readonly name = 'normalize';

  execute(input: PipelineInput): NormalizedTitle | null {
    const normalized = normalizeTitle(input.rawTitle);

    if (normalized.length < 3) {
      return null;
    }

    return { raw: input.rawTitle, normalized };
  }
}
