import { MatchProductSetLayer } from '../layers/match-product-set';
import {
  MatchableProductSet,
  TypeMatchResult,
  NormalizedTitle,
  MatchableProductType,
} from '../types';

// ── Test fixtures ──

const SETS: MatchableProductSet[] = [
  { id: 'sv08', name: 'Surging Sparks', series: 'Scarlet & Violet' },
  { id: 'sv07', name: 'Stellar Crown', series: 'Scarlet & Violet' },
  { id: 'sv06', name: 'Twilight Masquerade', series: 'Scarlet & Violet' },
  { id: 'sv-generic', name: 'Scarlet & Violet', series: 'Scarlet & Violet' },
  { id: 'xy-me', name: 'Mega Evolution', series: 'Mega Evolution' },
  { id: 'xy-pf', name: 'Phantasmal Flames', series: 'Mega Evolution' },
  { id: 'xy-po', name: 'Perfect Order', series: 'Mega Evolution' },
  { id: 'sv09', name: 'Destined Rivals', series: 'Scarlet & Violet' },
];

const BOOSTER_BOX_TYPE: MatchableProductType = {
  id: 'booster-box',
  name: 'Booster Box',
  matchingProfile: { required: ['booster', 'box'], forbidden: [] },
};

function makeInput(residualTitle: string): TypeMatchResult {
  const title: NormalizedTitle = {
    raw: residualTitle,
    normalized: residualTitle,
  };
  return {
    title,
    matchedType: BOOSTER_BOX_TYPE,
    residualTitle,
    typeMatchScore: 100,
  };
}

// ── Tests ──

describe('MatchProductSetLayer', () => {
  const layer = new MatchProductSetLayer(SETS);

  describe('simple matching', () => {
    it('matches a set by exact tokens in residual', () => {
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.productSet.id).toBe('sv08');
    });

    it('matches another set', () => {
      const result = layer.execute(makeInput('stellar crown'));
      expect(result?.productSet.id).toBe('sv07');
    });

    it('matches multi-word set name', () => {
      const result = layer.execute(makeInput('twilight masquerade'));
      expect(result?.productSet.id).toBe('sv06');
    });

    it('matches with extra tokens in residual', () => {
      const result = layer.execute(makeInput('surging sparks pokemon tcg'));
      expect(result?.productSet.id).toBe('sv08');
    });

    it('returns score between 0 and 100', () => {
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.setMatchScore).toBeGreaterThanOrEqual(85);
      expect(result?.setMatchScore).toBeLessThanOrEqual(100);
    });

    it('returns 100 for exact match', () => {
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.setMatchScore).toBe(100);
    });
  });

  describe('generic set exclusion', () => {
    it('excludes generic set when a specific set in same series matches', () => {
      // "surging sparks" matches both "Surging Sparks" (specific) and
      // potentially "Scarlet & Violet" (generic) — but generic should not
      // match here because "scarlet" and "violet" tokens are not in "surging sparks"
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.productSet.id).toBe('sv08');
    });

    it('accepts generic set when no specific set matches', () => {
      const result = layer.execute(makeInput('scarlet violet'));
      expect(result?.productSet.id).toBe('sv-generic');
    });

    it('excludes generic Mega Evolution when Phantasmal Flames matches', () => {
      const result = layer.execute(makeInput('phantasmal flames'));
      expect(result?.productSet.id).toBe('xy-pf');
    });

    it('matches generic Mega Evolution when only it matches', () => {
      const result = layer.execute(makeInput('mega evolution'));
      expect(result?.productSet.id).toBe('xy-me');
    });
  });

  describe('multi-match behavior', () => {
    it('returns null when multiple non-generic sets match', () => {
      // Build sets that would both match the same residual
      const ambiguousSets: MatchableProductSet[] = [
        { id: 'set-a', name: 'Sparks', series: 'Series A' },
        { id: 'set-b', name: 'Sparks', series: 'Series B' },
      ];
      const ambiguousLayer = new MatchProductSetLayer(ambiguousSets);
      const result = ambiguousLayer.execute(makeInput('sparks'));
      expect(result).toBeNull();
    });
  });

  describe('fuzzy tolerance', () => {
    it('matches despite minor typo in set name', () => {
      // "surgng" vs "surging" — fuzz.ratio should be above 85%
      const result = layer.execute(makeInput('surgng sparks'));
      expect(result?.productSet.id).toBe('sv08');
    });

    it('rejects when set tokens are completely different', () => {
      const result = layer.execute(makeInput('xyz abc'));
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for empty residual', () => {
      const result = layer.execute(makeInput(''));
      expect(result).toBeNull();
    });

    it('returns null when no set matches', () => {
      const result = layer.execute(makeInput('completely unknown set'));
      expect(result).toBeNull();
    });

    it('preserves type info from previous layer', () => {
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.productType.id).toBe('booster-box');
      expect(result?.typeMatchScore).toBe(100);
    });

    it('preserves title info from previous layers', () => {
      const result = layer.execute(makeInput('surging sparks'));
      expect(result?.title.normalized).toBe('surging sparks');
    });

    it('handles set with empty name', () => {
      const layerWithEmpty = new MatchProductSetLayer([{ id: 'empty', name: '', series: 'Empty' }]);
      const result = layerWithEmpty.execute(makeInput('anything'));
      expect(result).toBeNull();
    });
  });
});
