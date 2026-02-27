/**
 * Layer 3: Non-English product filter (post-normalization).
 *
 * Detects titles indicating a non-English Pokémon TCG product (Japanese,
 * Korean, Chinese) and discards them by returning null. Operates on
 * already-normalized text (lowercase ASCII, spaces only).
 *
 * This layer CAN return null — when a non-English indicator is found the
 * product is excluded from further matching.
 */

import { PipelineLayer, NormalizedTitle } from '../types';

/**
 * Single regex matching all non-English language indicators as standalone words.
 *
 * Word boundaries (\b) ensure short abbreviations like "jp" match only as
 * whole words and NOT inside longer tokens like "jpy".  Since the input is
 * already normalized (lowercase ASCII, punctuation → spaces), \b reliably
 * delineates word edges.
 *
 * Covers:
 *   English  — jp, jpn, japan, japanese, korea, korean, china, chinese
 *   Polish   — japonski/japonska/japonskie, koreanski/koreanska/koreanskie,
 *              chinskie/chinski/chinska (diacritics stripped by normalize)
 */
const NON_ENGLISH_PATTERN =
  /\b(?:jp|jpn|japan|japanese|korea|korean|china|chinese|japonski|japonska|japonskie|japonscy|koreanski|koreanska|koreanskie|chinskie|chinski|chinska)\b/;

// ── Layer implementation ──

export class FilterNonEnglishLayer implements PipelineLayer<NormalizedTitle, NormalizedTitle> {
  readonly name = 'filter-non-english';

  execute(input: NormalizedTitle): NormalizedTitle | null {
    if (NON_ENGLISH_PATTERN.test(input.normalized)) {
      return null;
    }

    return input;
  }
}
