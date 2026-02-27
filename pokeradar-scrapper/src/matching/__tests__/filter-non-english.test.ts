import { FilterNonEnglishLayer } from '../layers/filter-non-english';
import { NormalizedTitle } from '../types';

// ── Helpers ──

function input(normalized: string, raw?: string): NormalizedTitle {
  return { raw: raw ?? normalized, normalized };
}

const layer = new FilterNonEnglishLayer();

// ── Tests ──

describe('FilterNonEnglishLayer', () => {
  // ── Titles that SHOULD be discarded (non-English indicators) ──

  describe('discards non-English products', () => {
    it('discards titles containing "japan"', () => {
      expect(layer.execute(input('pokemon tcg japan black bolt booster'))).toBeNull();
    });

    it('discards titles containing "japanese"', () => {
      expect(layer.execute(input('pokemon tcg japanese booster box'))).toBeNull();
    });

    it('discards titles containing "korea"', () => {
      expect(layer.execute(input('pokemon tcg korea white flare booster'))).toBeNull();
    });

    it('discards titles containing "korean"', () => {
      expect(layer.execute(input('pokemon tcg korean booster box'))).toBeNull();
    });

    it('discards titles containing "china"', () => {
      expect(layer.execute(input('pokemon tcg china booster'))).toBeNull();
    });

    it('discards titles containing "chinese"', () => {
      expect(layer.execute(input('pokemon tcg chinese booster box'))).toBeNull();
    });

    it('discards titles containing standalone "jpn"', () => {
      expect(
        layer.execute(
          input('pokemon tcg scarlet violet white flare black bolt unova poster collection jpn'),
        ),
      ).toBeNull();
    });

    it('discards titles containing standalone "jp"', () => {
      expect(layer.execute(input('zekrom ex sv11b 161 black bolt jp sv11b'))).toBeNull();
    });

    it('discards titles containing "japonski" (Polish masculine)', () => {
      expect(layer.execute(input('pokemon black bolt japonski booster box sv11b'))).toBeNull();
    });

    it('discards titles containing "japonska" (Polish feminine)', () => {
      expect(
        layer.execute(
          input('pokemon tcg battle partners booster box japonska wersja sv9 30 boosterow'),
        ),
      ).toBeNull();
    });

    it('discards titles containing "japonskie" (Polish neuter/plural)', () => {
      expect(layer.execute(input('karty japonskie pokemon tcg'))).toBeNull();
    });

    it('discards titles containing "koreanski" (Polish masculine)', () => {
      expect(layer.execute(input('pokemon tcg koreanski booster box'))).toBeNull();
    });

    it('discards titles containing "koreanska" (Polish feminine)', () => {
      expect(layer.execute(input('pokemon tcg koreanska edycja booster box'))).toBeNull();
    });

    it('discards titles containing "chinskie" (Polish neuter/plural)', () => {
      expect(layer.execute(input('karty chinskie pokemon tcg'))).toBeNull();
    });

    it('discards titles containing "chinski" (Polish masculine)', () => {
      expect(layer.execute(input('pokemon tcg chinski booster box'))).toBeNull();
    });
  });

  // ── Titles that MUST NOT be discarded (false-positive safety) ──

  describe('does not discard English products', () => {
    it('keeps normal English titles', () => {
      expect(layer.execute(input('pokemon tcg surging sparks booster box'))).not.toBeNull();
    });

    it('does not match "jp" inside "jpy" (currency)', () => {
      expect(layer.execute(input('pokemon tcg 5000 jpy gift card'))).not.toBeNull();
    });

    it('does not match "jp" inside other words', () => {
      expect(layer.execute(input('some jpword product'))).not.toBeNull();
    });

    it('does not match "jpn" inside other words', () => {
      expect(layer.execute(input('some jpnx product'))).not.toBeNull();
    });

    it('keeps titles with set numbers that look similar', () => {
      expect(
        layer.execute(input('pokemon tcg scarlet violet prismatic evolutions elite trainer box')),
      ).not.toBeNull();
    });

    it('keeps titles with only English content and no language indicators', () => {
      expect(layer.execute(input('pokemon tcg black bolt booster box sv11b'))).not.toBeNull();
    });
  });

  // ── Passthrough behaviour ──

  describe('passthrough behaviour', () => {
    it('preserves the raw field when title passes through', () => {
      const result = layer.execute(
        input('surging sparks booster box', 'Surging Sparks Booster Box'),
      );
      expect(result).not.toBeNull();
      expect(result!.raw).toBe('Surging Sparks Booster Box');
    });

    it('returns the exact same object reference on passthrough', () => {
      const inp = input('surging sparks booster box');
      expect(layer.execute(inp)).toBe(inp);
    });
  });
});
