import { MatchProductTypeLayer } from '../layers/match-product-type';
import { MatchableProductType, NormalizedTitle } from '../types';

// ── Test fixtures ──

const TYPES: MatchableProductType[] = [
  {
    id: 'booster',
    name: 'Booster',
    matchingProfile: { required: ['booster'], forbidden: [] },
  },
  {
    id: 'booster-box',
    name: 'Booster Box',
    matchingProfile: { required: ['booster', 'box'], forbidden: [] },
  },
  {
    id: 'half-booster-box',
    name: 'Half Booster Box',
    matchingProfile: { required: ['half', 'booster', 'box'], forbidden: [] },
  },
  {
    id: 'booster-bundle',
    name: 'Booster Bundle',
    matchingProfile: { required: ['booster', 'bundle'], forbidden: [] },
  },
  {
    id: 'etb',
    name: 'Elite Trainer Box',
    matchingProfile: { required: ['elite', 'trainer', 'box'], forbidden: [] },
  },
  {
    id: 'mini-tin',
    name: 'Mini Tin',
    matchingProfile: { required: ['mini', 'tin'], forbidden: [] },
  },
  {
    id: 'mini-tin-display',
    name: 'Mini Tin Display',
    matchingProfile: { required: ['mini', 'tin', 'display'], forbidden: [] },
  },
];

function input(normalized: string): NormalizedTitle {
  return { raw: normalized, normalized };
}

// ── Tests ──

describe('MatchProductTypeLayer', () => {
  const layer = new MatchProductTypeLayer(TYPES);

  describe('specificity ordering', () => {
    it('matches Booster Box over Booster', () => {
      const result = layer.execute(input('surging sparks booster box'));
      expect(result?.matchedType.id).toBe('booster-box');
    });

    it('matches Half Booster Box over Booster Box', () => {
      const result = layer.execute(input('surging sparks half booster box'));
      expect(result?.matchedType.id).toBe('half-booster-box');
    });

    it('matches Booster Bundle over Booster', () => {
      const result = layer.execute(input('surging sparks booster bundle'));
      expect(result?.matchedType.id).toBe('booster-bundle');
    });

    it('matches ETB correctly', () => {
      const result = layer.execute(input('surging sparks elite trainer box'));
      expect(result?.matchedType.id).toBe('etb');
    });

    it('matches Mini Tin Display over Mini Tin', () => {
      const result = layer.execute(input('surging sparks mini tin display'));
      expect(result?.matchedType.id).toBe('mini-tin-display');
    });

    it('matches Mini Tin when display is absent', () => {
      const result = layer.execute(input('surging sparks mini tin'));
      expect(result?.matchedType.id).toBe('mini-tin');
    });

    it('falls back to Booster when no more specific type matches', () => {
      const result = layer.execute(input('surging sparks booster'));
      expect(result?.matchedType.id).toBe('booster');
    });
  });

  describe('forbidden tokens', () => {
    const typesWithForbidden: MatchableProductType[] = [
      {
        id: 'booster',
        name: 'Booster',
        matchingProfile: { required: ['booster'], forbidden: ['kiosk', 'promo'] },
      },
    ];
    const layerWithForbidden = new MatchProductTypeLayer(typesWithForbidden);

    it('rejects title containing a forbidden token', () => {
      const result = layerWithForbidden.execute(input('surging sparks booster kiosk'));
      expect(result).toBeNull();
    });

    it('does not reject on substring match of forbidden token', () => {
      // "promo" is forbidden, but "promotion" should not be blocked
      const result = layerWithForbidden.execute(input('surging sparks booster promotion'));
      expect(result).not.toBeNull();
    });

    it('accepts title without forbidden tokens', () => {
      const result = layerWithForbidden.execute(input('surging sparks booster'));
      expect(result?.matchedType.id).toBe('booster');
    });
  });

  describe('fuzzy tolerance', () => {
    it('matches despite minor typo (boosters vs booster)', () => {
      const result = layer.execute(input('surging sparks boosters box'));
      expect(result?.matchedType.id).toBe('booster-box');
    });

    it('rejects wildly different token', () => {
      const result = layer.execute(input('surging sparks xyz box'));
      // "xyz" does not fuzzy-match "booster" at 90% threshold
      expect(result?.matchedType.id).not.toBe('booster-box');
    });
  });

  describe('residual title', () => {
    it('removes matched type tokens from title', () => {
      const result = layer.execute(input('surging sparks booster box pokemon'));
      expect(result?.residualTitle).toBe('surging sparks pokemon');
    });

    it('removes all tokens for multi-token type', () => {
      const result = layer.execute(input('surging sparks elite trainer box'));
      expect(result?.residualTitle).toBe('surging sparks');
    });

    it('handles duplicate type tokens in title gracefully', () => {
      const result = layer.execute(input('booster box booster box surging sparks'));
      expect(result?.matchedType.id).toBe('booster-box');
      // Both occurrences removed
      expect(result?.residualTitle).toBe('surging sparks');
    });
  });

  describe('score', () => {
    it('returns a score between 0 and 100', () => {
      const result = layer.execute(input('surging sparks booster box'));
      expect(result?.typeMatchScore).toBeGreaterThanOrEqual(90);
      expect(result?.typeMatchScore).toBeLessThanOrEqual(100);
    });

    it('returns 100 for exact token matches', () => {
      const result = layer.execute(input('surging sparks booster box'));
      expect(result?.typeMatchScore).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('returns null when no type matches', () => {
      const result = layer.execute(input('some random product title'));
      expect(result).toBeNull();
    });

    it('handles type with no required tokens', () => {
      const layerWithEmpty = new MatchProductTypeLayer([
        { id: 'empty', name: 'Empty', matchingProfile: { required: [], forbidden: [] } },
      ]);
      const result = layerWithEmpty.execute(input('anything'));
      expect(result).toBeNull();
    });

    it('handles single-word title', () => {
      const result = layer.execute(input('booster'));
      expect(result?.matchedType.id).toBe('booster');
    });

    it('defensively splits multi-word required tokens', () => {
      const layerWithMultiWord = new MatchProductTypeLayer([
        {
          id: 'bb',
          name: 'Booster Box',
          matchingProfile: { required: ['Booster Box'], forbidden: [] },
        },
      ]);
      const result = layerWithMultiWord.execute(input('surging sparks booster box'));
      expect(result?.matchedType.id).toBe('bb');
    });

    it('deterministic ordering for same token count', () => {
      // Booster Box and Booster Bundle both have 2 tokens.
      // Alphabetical tiebreak: "Booster Box" < "Booster Bundle"
      // Title has both "box" and "bundle" — Booster Box should match first.
      const result = layer.execute(input('surging sparks booster box bundle'));
      expect(result?.matchedType.id).toBe('booster-box');
    });
  });
});
