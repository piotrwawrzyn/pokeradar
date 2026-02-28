/**
 * Layer 3: Non-English product filter (post-normalization).
 *
 * Detects titles indicating a non-English Pokémon TCG product and discards
 * them by returning null. Operates on already-normalized text (lowercase
 * ASCII, spaces only).
 *
 * Covers all TCG print languages: Japanese, Korean, Chinese, French,
 * German, Spanish, Italian, and Brazilian Portuguese.
 *
 * This layer CAN return null — when a non-English indicator is found the
 * product is excluded from further matching.
 */

import { PipelineLayer, PipelineLogger, NormalizedTitle } from '../types';

/**
 * Non-English language tokens grouped by language.
 *
 * Each array contains English names, native names, Polish translations, and
 * ISO codes for that language. All tokens are post-normalization (lowercase
 * ASCII, diacritics stripped).
 *
 * Word boundaries (\b) in the compiled regex ensure short codes like "jp"
 * match only as whole words and NOT inside longer tokens like "jpy".
 *
 * IMPORTANT: "it" is deliberately excluded — it matches the English pronoun
 * and would cause false positives. Italian is caught by longer tokens only.
 */

const LANGUAGE_TOKENS: Record<string, string[]> = {
  japanese: ['jp', 'jpn', 'japan', 'japanese', 'japonski', 'japonska', 'japonskie', 'japonscy'],
  korean: ['kr', 'korea', 'korean', 'koreanski', 'koreanska', 'koreanskie'],
  chinese: ['cn', 'china', 'chinese', 'chinski', 'chinska', 'chinskie'],
  french: ['fr', 'french', 'france', 'francuski', 'francuska', 'francuskie'],
  german: [
    'de',
    'german',
    'germany',
    'deutsch',
    'deutsche',
    'deutscher',
    'deutsches',
    'niemiecki',
    'niemiecka',
    'niemieckie',
  ],
  spanish: [
    'es',
    'spanish',
    'spain',
    'espanol',
    'espanola',
    'hiszpanski',
    'hiszpanska',
    'hiszpanskie',
  ],
  italian: ['italian', 'italy', 'italiano', 'italiana', 'wloski', 'wloska', 'wloskie'],
  portuguese: [
    'pt',
    'br',
    'portuguese',
    'brazil',
    'brazilian',
    'portugues',
    'portuguesa',
    'portugalski',
    'portugalska',
    'portugalskie',
    'brazylijski',
    'brazylijska',
    'brazylijskie',
  ],
};

const NON_ENGLISH_PATTERN = new RegExp(
  `\\b(?:${Object.values(LANGUAGE_TOKENS).flat().join('|')})\\b`,
);

// ── Layer implementation ──

export class FilterNonEnglishLayer implements PipelineLayer<NormalizedTitle, NormalizedTitle> {
  readonly name = 'filter-non-english';

  constructor(private logger?: PipelineLogger) {}

  execute(input: NormalizedTitle): NormalizedTitle | null {
    if (NON_ENGLISH_PATTERN.test(input.normalized)) {
      this.logger?.warn('Non-English product filtered out', { title: input.raw });
      return null;
    }

    return input;
  }
}
