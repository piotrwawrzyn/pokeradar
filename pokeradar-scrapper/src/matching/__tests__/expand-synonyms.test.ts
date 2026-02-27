import { ExpandSynonymsLayer } from '../layers/expand-synonyms';
import { MatchableProductSet, NormalizedTitle } from '../types';

// ── Helpers ──

function input(normalized: string, raw?: string): NormalizedTitle {
  return { raw: raw ?? normalized, normalized };
}

/** Minimal set fixture with the fields required by ExpandSynonymsLayer. */
function set(
  id: string,
  name: string,
  setNumber: string,
  setAbbreviation: string,
): MatchableProductSet {
  return { id, name, series: 'Scarlet & Violet', setNumber, setAbbreviation };
}

const SETS: MatchableProductSet[] = [
  set('sv08', 'Surging Sparks', 'SV8', 'SSP'),
  set('sv07', 'Stellar Crown', 'SV7', 'SCR'),
  set('sv09', 'Journey Together', 'SV9', 'JTG'),
  set('sv06', 'Twilight Masquerade', 'SV6', 'TWM'),
  set('sv035', '151', 'SV3.5', 'MEW'),
];

// ── Tests ──

describe('ExpandSynonymsLayer', () => {
  const layer = new ExpandSynonymsLayer(SETS);

  // ── Product-type synonyms ──

  describe('product-type synonyms', () => {
    it('expands ETB to "elite trainer box"', () => {
      const result = layer.execute(input('surging sparks etb'));
      expect(result.normalized).toBe('surging sparks elite trainer box');
    });

    it('expands BB to "booster box"', () => {
      const result = layer.execute(input('surging sparks bb'));
      expect(result.normalized).toBe('surging sparks booster box');
    });

    it('expands checklane to "blister"', () => {
      const result = layer.execute(input('surging sparks checklane'));
      expect(result.normalized).toBe('surging sparks blister');
    });

    it('expands 3pk to "3 pack"', () => {
      const result = layer.execute(input('surging sparks 3pk'));
      expect(result.normalized).toBe('surging sparks 3 pack');
    });

    it('expands trojpak (Polish, already diacritic-stripped by normalize) to "3 pack"', () => {
      const result = layer.execute(input('surging sparks trojpak'));
      expect(result.normalized).toBe('surging sparks 3 pack');
    });

    it('does not need to expand 3-pack — normalize layer converts the dash to a space first', () => {
      // "3-Pack" → normalize → "3 pack" — no expansion needed here
      const result = layer.execute(input('surging sparks 3 pack'));
      expect(result.normalized).toBe('surging sparks 3 pack');
    });

    it('expands 2pk to "2 pack"', () => {
      const result = layer.execute(input('surging sparks 2pk'));
      expect(result.normalized).toBe('surging sparks 2 pack');
    });

    it('does not need to expand 2-pack — normalize layer converts the dash to a space first', () => {
      // "2-Pack" → normalize → "2 pack" — no expansion needed here
      const result = layer.execute(input('surging sparks 2 pack'));
      expect(result.normalized).toBe('surging sparks 2 pack');
    });

    it('expands puszka to "tin"', () => {
      const result = layer.execute(input('surging sparks puszka'));
      expect(result.normalized).toBe('surging sparks tin');
    });

    it('expands bundle 10 to "display" (normalize converts parens to spaces before this layer)', () => {
      // "Bundle (10)" → normalize → "bundle 10" → expand → "display"
      const result = layer.execute(input('surging sparks bundle 10'));
      expect(result.normalized).toBe('surging sparks display');
    });

    it('does not expand ETB when it is a substring of another word', () => {
      // e.g. "etbx" should not become "elite trainer boxx"
      const result = layer.execute(input('etbx product'));
      expect(result.normalized).toBe('etbx product');
    });

    it('does not expand BB when it is a substring of another word', () => {
      // "abba" should not become "abooster boxa"
      const result = layer.execute(input('abba album'));
      expect(result.normalized).toBe('abba album');
    });
  });

  // ── Set identifier expansion ──

  describe('set identifier expansion — set number', () => {
    it('expands sv8 to "surging sparks"', () => {
      const result = layer.execute(input('sv8 booster box'));
      expect(result.normalized).toBe('surging sparks booster box');
    });

    it('expands sv7 to "stellar crown"', () => {
      const result = layer.execute(input('sv7 booster box'));
      expect(result.normalized).toBe('stellar crown booster box');
    });

    it('expands sv3 5 (normalised form of SV3.5) to "151"', () => {
      // normalizeTitle('SV3.5') → 'sv3 5' (dot → space)
      const result = layer.execute(input('sv3 5 booster'));
      expect(result.normalized).toBe('151 booster');
    });
  });

  describe('set identifier expansion — three-letter abbreviation', () => {
    it('expands ssp to "surging sparks"', () => {
      const result = layer.execute(input('ssp booster box'));
      expect(result.normalized).toBe('surging sparks booster box');
    });

    it('expands scr to "stellar crown"', () => {
      const result = layer.execute(input('scr booster box'));
      expect(result.normalized).toBe('stellar crown booster box');
    });

    it('expands mew to "151"', () => {
      const result = layer.execute(input('mew booster box'));
      expect(result.normalized).toBe('151 booster box');
    });
  });

  // ── Combined expansion ──

  describe('combined expansion', () => {
    it('expands both set number and product type in a single title', () => {
      // "sv8 etb" → set expands → "surging sparks etb" → type expands → "surging sparks elite trainer box"
      const result = layer.execute(input('sv8 etb'));
      expect(result.normalized).toBe('surging sparks elite trainer box');
    });

    it('expands set abbreviation and product type together', () => {
      const result = layer.execute(input('ssp bb'));
      expect(result.normalized).toBe('surging sparks booster box');
    });
  });

  // ── Passthrough and raw preservation ──

  describe('passthrough behaviour', () => {
    it('returns input unchanged when no synonym matches', () => {
      const result = layer.execute(input('surging sparks booster box'));
      expect(result.normalized).toBe('surging sparks booster box');
    });

    it('always preserves the raw field', () => {
      const result = layer.execute(input('surging sparks etb', 'Surging Sparks ETB'));
      expect(result.raw).toBe('Surging Sparks ETB');
    });

    it('preserves raw even when no expansion occurs', () => {
      const result = layer.execute(
        input('surging sparks booster box', 'Surging Sparks Booster Box'),
      );
      expect(result.raw).toBe('Surging Sparks Booster Box');
    });

    it('never returns null', () => {
      // The layer contract: always returns NormalizedTitle, never null
      const result = layer.execute(input(''));
      expect(result).not.toBeNull();
    });
  });

  // ── Whitespace handling ──

  describe('whitespace normalisation', () => {
    it('collapses extra spaces that multi-word replacements may introduce', () => {
      // After expansion, whitespace is collapsed to single spaces
      const result = layer.execute(input('sv8   etb'));
      expect(result.normalized).not.toMatch(/\s{2,}/);
    });
  });

  // ── No sets ──

  describe('constructed without sets', () => {
    const layerNoSets = new ExpandSynonymsLayer([]);

    it('still applies product-type synonyms when no sets are provided', () => {
      const result = layerNoSets.execute(input('sv8 etb'));
      // Set expansion does nothing, but ETB is still expanded
      expect(result.normalized).toBe('sv8 elite trainer box');
    });
  });
});
