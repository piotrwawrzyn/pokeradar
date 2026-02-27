import { ExpandSynonymsLayer } from '../layers/expand-synonyms';
import { NormalizedTitle } from '../types';

// ── Helpers ──

function input(normalized: string, raw?: string): NormalizedTitle {
  return { raw: raw ?? normalized, normalized };
}

// ExpandSynonymsLayer is now a pure product-type synonym layer — no sets needed.
const layer = new ExpandSynonymsLayer();

// ── Tests ──

describe('ExpandSynonymsLayer', () => {
  // ── Product-type synonyms ──

  describe('product-type synonyms', () => {
    it('expands ETB to "elite trainer box"', () => {
      expect(layer.execute(input('surging sparks etb')).normalized).toBe(
        'surging sparks elite trainer box',
      );
    });

    it('expands BB to "booster box"', () => {
      expect(layer.execute(input('surging sparks bb')).normalized).toBe(
        'surging sparks booster box',
      );
    });

    it('expands "booster display" to "booster box"', () => {
      expect(layer.execute(input('surging sparks booster display')).normalized).toBe(
        'surging sparks booster box',
      );
    });

    it('expands checklane to "blister"', () => {
      expect(layer.execute(input('surging sparks checklane')).normalized).toBe(
        'surging sparks blister',
      );
    });

    it('expands 3pk to "3 pack"', () => {
      expect(layer.execute(input('surging sparks 3pk')).normalized).toBe('surging sparks 3 pack');
    });

    it('expands 3pack (merged, no separator) to "3 pack"', () => {
      expect(layer.execute(input('surging sparks 3pack')).normalized).toBe('surging sparks 3 pack');
    });

    it('expands trojpak (Polish, already diacritic-stripped by normalize) to "3 pack"', () => {
      expect(layer.execute(input('surging sparks trojpak')).normalized).toBe(
        'surging sparks 3 pack',
      );
    });

    it('does not need to expand 3-pack — normalize layer converts the dash to a space first', () => {
      expect(layer.execute(input('surging sparks 3 pack')).normalized).toBe(
        'surging sparks 3 pack',
      );
    });

    it('expands 2pk to "2 pack"', () => {
      expect(layer.execute(input('surging sparks 2pk')).normalized).toBe('surging sparks 2 pack');
    });

    it('expands 2pack (merged, no separator) to "2 pack"', () => {
      expect(layer.execute(input('ascended heroes 2pack blister larry')).normalized).toBe(
        'ascended heroes 2 pack blister larry',
      );
    });

    it('does not need to expand 2-pack — normalize layer converts the dash to a space first', () => {
      expect(layer.execute(input('surging sparks 2 pack')).normalized).toBe(
        'surging sparks 2 pack',
      );
    });

    it('expands puszka to "tin"', () => {
      expect(layer.execute(input('surging sparks puszka')).normalized).toBe('surging sparks tin');
    });

    it('expands bundle 10 to "display" (normalize converts parens to spaces before this layer)', () => {
      expect(layer.execute(input('surging sparks bundle 10')).normalized).toBe(
        'surging sparks display',
      );
    });

    it('expands "mini tin box 10" to "mini tin display"', () => {
      expect(
        layer.execute(input('mega evolution ascended heroes mini tin box 10')).normalized,
      ).toBe('mega evolution ascended heroes mini tin display');
    });

    it('expands "mini tin 10 szt" to "mini tin display"', () => {
      expect(
        layer.execute(input('mega evolution ascended heroes mini tin 10 szt')).normalized,
      ).toBe('mega evolution ascended heroes mini tin display szt');
    });

    it('expands "mini tin komplet 5 sztuk" to "mini tin bundle"', () => {
      expect(layer.execute(input('ascended heroes mini tin komplet 5 sztuk')).normalized).toBe(
        'ascended heroes mini tin bundle sztuk',
      );
    });

    it('expands "mini tin zestaw 5 wzorow" to "mini tin bundle"', () => {
      expect(layer.execute(input('ascended heroes mini tin zestaw 5 wzorow')).normalized).toBe(
        'ascended heroes mini tin bundle wzorow',
      );
    });

    it('does not expand ETB when it is a substring of another word', () => {
      expect(layer.execute(input('etbx product')).normalized).toBe('etbx product');
    });

    it('does not expand BB when it is a substring of another word', () => {
      expect(layer.execute(input('abba album')).normalized).toBe('abba album');
    });
  });

  // ── Passthrough and raw preservation ──

  describe('passthrough behaviour', () => {
    it('returns input unchanged when no synonym matches', () => {
      expect(layer.execute(input('surging sparks booster box')).normalized).toBe(
        'surging sparks booster box',
      );
    });

    it('always preserves the raw field', () => {
      expect(layer.execute(input('surging sparks etb', 'Surging Sparks ETB')).raw).toBe(
        'Surging Sparks ETB',
      );
    });

    it('preserves raw even when no expansion occurs', () => {
      expect(
        layer.execute(input('surging sparks booster box', 'Surging Sparks Booster Box')).raw,
      ).toBe('Surging Sparks Booster Box');
    });

    it('never returns null', () => {
      expect(layer.execute(input(''))).not.toBeNull();
    });
  });

  // ── Whitespace handling ──

  describe('whitespace normalisation', () => {
    it('collapses extra spaces that multi-word replacements may introduce', () => {
      expect(layer.execute(input('surging sparks   etb')).normalized).not.toMatch(/\s{2,}/);
    });
  });
});
