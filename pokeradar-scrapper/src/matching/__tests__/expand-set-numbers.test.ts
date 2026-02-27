import { ExpandSetNumbersLayer } from '../layers/expand-set-numbers';
import { MatchableProductSet } from '../types';

// ── Helpers ──

function input(rawTitle: string) {
  return { rawTitle };
}

/** Minimal set fixture. */
function set(id: string, name: string, setNumber: string): MatchableProductSet {
  return { id, name, series: 'Scarlet & Violet', setNumber, setAbbreviation: 'XXX' };
}

const SETS: MatchableProductSet[] = [
  set('sv08', 'Surging Sparks', 'SV8'),
  set('sv07', 'Stellar Crown', 'SV7'),
  set('sv09', 'Journey Together', 'SV9'),
  set('sv06', 'Twilight Masquerade', 'SV6'),
  set('sv035', '151', 'SV3.5'),
  set('me02', 'Phantasmal Flames', 'ME2'),
  set('me03', 'Extradimensional Crisis', 'ME3'),
  set('me025', 'Ascended Heroes', 'ME2.5'),
];

const layer = new ExpandSetNumbersLayer(SETS);

// ── Tests ──

describe('ExpandSetNumbersLayer', () => {
  // ── Simple set numbers ──

  describe('simple set number expansion', () => {
    it('expands SV8 to set name (uppercase)', () => {
      expect(layer.execute(input('SV8 Booster Box')).rawTitle).toBe('Surging Sparks Booster Box');
    });

    it('expands sv8 to set name (lowercase)', () => {
      expect(layer.execute(input('sv8 booster box')).rawTitle).toBe('Surging Sparks booster box');
    });

    it('expands SV7 to "Stellar Crown"', () => {
      expect(layer.execute(input('SV7 Elite Trainer Box')).rawTitle).toBe(
        'Stellar Crown Elite Trainer Box',
      );
    });

    it('expands ME2 to "Phantasmal Flames"', () => {
      expect(layer.execute(input('ME2 Blister')).rawTitle).toBe('Phantasmal Flames Blister');
    });
  });

  // ── Spaced set numbers (e.g. "SV 8" instead of "SV8") ──

  describe('spaced set number expansion', () => {
    it('expands "SV 8" (space between prefix and digit) identically to SV8', () => {
      expect(
        layer.execute(input('Pokemon TCG: Scarlet & Violet SV 8 Surging Sparks Booster Box (36)'))
          .rawTitle,
      ).toBe('Pokemon TCG: Scarlet & Violet Surging Sparks Surging Sparks Booster Box (36)');
    });

    it('expands "ME 2" (space) identically to ME2', () => {
      expect(layer.execute(input('ME 2 Blister')).rawTitle).toBe('Phantasmal Flames Blister');
    });

    it('expands "ME 2.5" (space before decimal) identically to ME2.5', () => {
      expect(layer.execute(input('ME 2.5 Ascended Heroes Booster')).rawTitle).toBe(
        'Ascended Heroes Ascended Heroes Booster',
      );
    });
  });

  // ── Zero-padded set numbers ──

  describe('zero-padded set number expansion', () => {
    it('expands ME02 (zero-padded) identically to ME2', () => {
      expect(layer.execute(input('ME02 Blister')).rawTitle).toBe('Phantasmal Flames Blister');
    });

    it('expands ME03 (zero-padded) identically to ME3', () => {
      expect(layer.execute(input('ME03 Booster Box')).rawTitle).toBe(
        'Extradimensional Crisis Booster Box',
      );
    });

    it('expands SV08 (zero-padded) identically to SV8', () => {
      expect(layer.execute(input('SV08 ETB')).rawTitle).toBe('Surging Sparks ETB');
    });
  });

  // ── Dot-decimal set numbers (the main reason for pre-normalization) ──

  describe('dot-decimal set number expansion', () => {
    it('expands SV3.5 to "151"', () => {
      expect(layer.execute(input('Pokemon TCG: SV3.5 - 151 Booster')).rawTitle).toBe(
        'Pokemon TCG: 151 - 151 Booster',
      );
    });

    it('expands SV03.5 (zero-padded) identically to SV3.5', () => {
      expect(layer.execute(input('SV03.5 Booster')).rawTitle).toBe('151 Booster');
    });

    it('expands ME2.5 to "Ascended Heroes"', () => {
      expect(layer.execute(input('POK TCG: ME2.5 - Deluxe Pin Collection')).rawTitle).toBe(
        'POK TCG: Ascended Heroes - Deluxe Pin Collection',
      );
    });

    it('expands ME02.5 (zero-padded) identically to ME2.5', () => {
      expect(layer.execute(input('POK TCG: ME02.5 - Deluxe Pin Collection')).rawTitle).toBe(
        'POK TCG: Ascended Heroes - Deluxe Pin Collection',
      );
    });

    it('dot is not treated as a word character — SV3.5x does not match', () => {
      // "SV3.5x" has no word boundary after the "5" before "x" — should not expand
      const result = layer.execute(input('SV3.5x Booster'));
      expect(result.rawTitle).toBe('SV3.5x Booster');
    });
  });

  // ── Comma decimal separator (Polish shops) ──

  describe('comma as decimal separator', () => {
    it('expands ME2,5 (comma) identically to ME2.5', () => {
      expect(layer.execute(input('Pokemon ME2,5 Ascended Heroes Booster')).rawTitle).toBe(
        'Pokemon Ascended Heroes Ascended Heroes Booster',
      );
    });

    it('expands ME02,5 (zero-padded, comma) identically to ME2.5', () => {
      expect(layer.execute(input('Pokemon ME02,5 Ascended Heroes Blister')).rawTitle).toBe(
        'Pokemon Ascended Heroes Ascended Heroes Blister',
      );
    });

    it('expands SV8,5 (comma) to Prismatic Evolutions', () => {
      const layerWithPE = new ExpandSetNumbersLayer([
        set('sv085', 'Prismatic Evolutions', 'SV8.5'),
      ]);
      expect(
        layerWithPE.execute(input('Pokemon SV8,5 TCG Prismatic Evolutions Booster Bundle'))
          .rawTitle,
      ).toBe('Pokemon Prismatic Evolutions TCG Prismatic Evolutions Booster Bundle');
    });
  });

  // ── Word boundary enforcement ──

  describe('word boundary enforcement', () => {
    it('does not expand SV8 when it is a substring (e.g. "CSV8")', () => {
      const result = layer.execute(input('CSV8 format'));
      expect(result.rawTitle).toBe('CSV8 format');
    });

    it('does not expand ME2 when preceded by another letter', () => {
      const result = layer.execute(input('aME2 blister'));
      expect(result.rawTitle).toBe('aME2 blister');
    });
  });

  // ── Passthrough ──

  describe('passthrough behaviour', () => {
    it('returns input unchanged when no set number matches', () => {
      const result = layer.execute(input('Surging Sparks Booster Box'));
      expect(result.rawTitle).toBe('Surging Sparks Booster Box');
    });

    it('preserves surrounding text unchanged', () => {
      const result = layer.execute(input('Pokemon TCG: SV8 - Elite Trainer Box'));
      expect(result.rawTitle).toBe('Pokemon TCG: Surging Sparks - Elite Trainer Box');
    });
  });

  // ── No sets ──

  describe('constructed without sets', () => {
    const layerNoSets = new ExpandSetNumbersLayer([]);

    it('passes title through unchanged', () => {
      expect(layerNoSets.execute(input('SV8 ETB')).rawTitle).toBe('SV8 ETB');
    });
  });
});
