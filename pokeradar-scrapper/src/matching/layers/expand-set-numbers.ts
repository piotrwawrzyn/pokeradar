/**
 * Layer 1b: Set number expansion (pre-normalization).
 *
 * Runs on the raw scraped title BEFORE normalization, so that set numbers like
 * "SV3.5" and "ME2.5" are matched and replaced literally — no need to handle
 * the dot→space conversion that the normalize layer applies.
 *
 * For each set, a case-insensitive word-boundary pattern is built from its
 * official set number. Zero-padded variants (e.g. "ME02" for a DB set number
 * "ME2") are handled by making the leading zero optional in the pattern.
 *
 * The replacement is the set's canonical name (as stored in the DB). After this
 * layer the normalize layer lowercases and strips special characters as usual,
 * so the replacement casing does not matter.
 *
 * This layer never returns null: if no expansion applies the input passes
 * through unchanged.
 */

import { PipelineLayer, PipelineInput, MatchableProductSet } from '../types';

/** A single set number rule: a word-boundary regex and its replacement name. */
interface SetNumberRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * Letters-only prefix + integer suffix, e.g. "SV8", "ME2".
 * Used to detect set numbers where zero-padding may occur.
 */
const LETTER_PREFIX_DIGIT = /^([A-Za-z]+)(0*)([1-9]\d*)$/;

/**
 * Letters + integer + dot + integer, e.g. "SV3.5", "ME2.5".
 * The leading-zero group captures optional zero-padding before the major digit.
 */
const LETTER_PREFIX_DIGIT_DOT_DIGIT = /^([A-Za-z]+)(0*)([1-9]\d*)\.(\d+)$/;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns a case-insensitive regex source that matches the raw set number,
 * accepting zero-padded variants.
 *
 * Examples:
 *   "ME2"   → "ME0?2"       (matches "ME2", "ME02", "me2", "me02")
 *   "SV8"   → "SV0?8"       (matches "SV8", "SV08", etc.)
 *   "SV3.5" → "SV0?3\\.5"   (matches "SV3.5", "SV03.5", etc.)
 *   "ME2.5" → "ME0?2\\.5"   (matches "ME2.5", "ME02.5", etc.)
 */
function buildSetNumberPattern(rawSetNumber: string): string {
  const dotMatch = LETTER_PREFIX_DIGIT_DOT_DIGIT.exec(rawSetNumber);
  if (dotMatch) {
    const [, prefix, , major, minor] = dotMatch;
    return `${escapeRegex(prefix)}0?${escapeRegex(major)}\\.${escapeRegex(minor)}`;
  }

  const simpleMatch = LETTER_PREFIX_DIGIT.exec(rawSetNumber);
  if (simpleMatch) {
    const [, prefix, , major] = simpleMatch;
    return `${escapeRegex(prefix)}0?${escapeRegex(major)}`;
  }

  return escapeRegex(rawSetNumber);
}

/**
 * Builds set number expansion rules from ProductSet reference data.
 * Each set with a non-empty setNumber contributes one case-insensitive rule.
 *
 * Rules are sorted by raw set number length descending so that more specific
 * set numbers (e.g. "ME2.5") are tried before shorter ones that share a prefix
 * (e.g. "ME2"). Without this ordering "ME2" would match first and leave ".5"
 * as a dangling fragment.
 */
function buildRules(productSets: MatchableProductSet[]): SetNumberRule[] {
  const rules: SetNumberRule[] = [];

  for (const set of productSets) {
    if (!set.setNumber || !set.name) continue;

    const pattern = buildSetNumberPattern(set.setNumber);
    rules.push({
      pattern: new RegExp(`\\b${pattern}\\b`, 'gi'),
      replacement: set.name,
    });
  }

  // Longer set numbers first — prevents a shorter prefix from consuming part of a longer one.
  // e.g. "ME2.5" must be tried before "ME2" to avoid the latter matching first and leaving ".5".
  rules.sort((a, b) => b.pattern.source.length - a.pattern.source.length);

  return rules;
}

export class ExpandSetNumbersLayer implements PipelineLayer<PipelineInput, PipelineInput> {
  readonly name = 'expand-set-numbers';

  private rules: SetNumberRule[];

  constructor(
    productSets: MatchableProductSet[],
    private logger?: { debug(message: string, meta?: Record<string, unknown>): void },
  ) {
    this.rules = buildRules(productSets);
  }

  execute(input: PipelineInput): PipelineInput {
    let expanded = input.rawTitle;

    for (const rule of this.rules) {
      // Reset lastIndex for global regexes (safety, since we reuse the instance)
      rule.pattern.lastIndex = 0;
      expanded = expanded.replace(rule.pattern, rule.replacement);
    }

    if (expanded !== input.rawTitle) {
      this.logger?.debug('Set number expansion applied', {
        original: input.rawTitle,
        expanded,
      });
    }

    return { rawTitle: expanded };
  }
}
