import { FilterNonEnglishLayer } from '../layers/filter-non-english';
import { NormalizedTitle } from '../types';

// ── Helpers ──

function input(normalized: string, raw?: string): NormalizedTitle {
  return { raw: raw ?? normalized, normalized };
}

const layer = new FilterNonEnglishLayer();

// ── Tests ──

describe('FilterNonEnglishLayer', () => {
  // ── Japanese ──

  describe('discards Japanese products', () => {
    it.each([
      ['japan', 'pokemon tcg japan black bolt booster'],
      ['japanese', 'pokemon tcg japanese booster box'],
      ['jp (standalone)', 'zekrom ex sv11b 161 black bolt jp sv11b'],
      ['jpn (standalone)', 'pokemon tcg scarlet violet white flare booster jpn'],
      ['japonski (Polish masculine)', 'pokemon black bolt japonski booster box sv11b'],
      ['japonska (Polish feminine)', 'pokemon tcg battle partners booster box japonska wersja sv9'],
      ['japonskie (Polish plural)', 'karty japonskie pokemon tcg'],
      ['japonscy (Polish masculine plural)', 'karty japonscy pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Korean ──

  describe('discards Korean products', () => {
    it.each([
      ['korea', 'pokemon tcg korea white flare booster'],
      ['korean', 'pokemon tcg korean booster box'],
      ['kr (standalone)', 'pokemon tcg surging sparks booster kr'],
      ['koreanski (Polish masculine)', 'pokemon tcg koreanski booster box'],
      ['koreanska (Polish feminine)', 'pokemon tcg koreanska edycja booster box'],
      ['koreanskie (Polish plural)', 'karty koreanskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Chinese ──

  describe('discards Chinese products', () => {
    it.each([
      ['china', 'pokemon tcg china booster'],
      ['chinese', 'pokemon tcg chinese booster box'],
      ['cn (standalone)', 'pokemon tcg surging sparks cn booster'],
      ['chinski (Polish masculine)', 'pokemon tcg chinski booster box'],
      ['chinska (Polish feminine)', 'pokemon tcg chinska edycja booster'],
      ['chinskie (Polish plural)', 'karty chinskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── French ──

  describe('discards French products', () => {
    it.each([
      ['french', 'pokemon tcg french booster box'],
      ['france', 'pokemon tcg surging sparks booster france'],
      ['fr (standalone)', 'pokemon tcg sv08 surging sparks booster fr'],
      ['francuski (Polish masculine)', 'pokemon tcg francuski booster box'],
      ['francuska (Polish feminine)', 'pokemon tcg francuska edycja booster'],
      ['francuskie (Polish plural)', 'karty francuskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── German ──

  describe('discards German products', () => {
    it.each([
      ['german', 'pokemon tcg german booster box'],
      ['germany', 'pokemon tcg surging sparks booster germany'],
      ['deutsch', 'pokemon tcg deutsch booster box'],
      ['deutsche', 'pokemon tcg deutsche ausgabe booster box'],
      ['deutscher', 'pokemon tcg deutscher booster box'],
      ['deutsches', 'pokemon tcg deutsches booster pack'],
      ['de (standalone)', 'pokemon tcg sv08 surging sparks booster de'],
      [
        'niemiecki (Polish masculine)',
        'pokemon tcg scarlet and violet surging sparks booster bundle 6 niemiecki',
      ],
      ['niemiecka (Polish feminine)', 'pokemon tcg niemiecka edycja booster'],
      ['niemieckie (Polish plural)', 'karty niemieckie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Spanish ──

  describe('discards Spanish products', () => {
    it.each([
      ['spanish', 'pokemon tcg spanish booster box'],
      ['spain', 'pokemon tcg surging sparks sleeved booster spain'],
      ['espanol', 'pokemon tcg espanol booster box'],
      ['espanola', 'pokemon tcg edicion espanola booster'],
      ['es (standalone)', 'pokemon tcg sv8 surging sparks sleeved booster es'],
      ['hiszpanski (Polish masculine)', 'pokemon tcg hiszpanski booster box'],
      ['hiszpanska (Polish feminine)', 'pokemon tcg hiszpanska edycja booster'],
      ['hiszpanskie (Polish plural)', 'karty hiszpanskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Italian ──

  describe('discards Italian products', () => {
    it.each([
      ['italian', 'pokemon tcg italian booster box'],
      ['italy', 'pokemon tcg surging sparks booster italy'],
      ['italiano', 'pokemon tcg italiano booster box'],
      ['italiana', 'pokemon tcg edizione italiana booster'],
      ['wloski (Polish masculine)', 'pokemon tcg wloski booster box'],
      ['wloska (Polish feminine)', 'pokemon tcg wloska edycja booster'],
      ['wloskie (Polish plural)', 'karty wloskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Brazilian Portuguese ──

  describe('discards Brazilian Portuguese products', () => {
    it.each([
      ['portuguese', 'pokemon tcg portuguese booster box'],
      ['brazil', 'pokemon tcg brazil booster box'],
      ['brazilian', 'pokemon tcg brazilian booster box'],
      ['portugues', 'pokemon tcg portugues booster box'],
      ['portuguesa', 'pokemon tcg edicion portuguesa booster'],
      ['pt (standalone)', 'pokemon tcg sv08 surging sparks booster pt'],
      ['br (standalone)', 'pokemon tcg sv08 surging sparks booster br'],
      ['portugalski (Polish masculine)', 'pokemon tcg portugalski booster box'],
      ['portugalska (Polish feminine)', 'pokemon tcg portugalska edycja booster'],
      ['portugalskie (Polish plural)', 'karty portugalskie pokemon tcg'],
      ['brazylijski (Polish masculine)', 'pokemon tcg brazylijski booster box'],
      ['brazylijska (Polish feminine)', 'pokemon tcg brazylijska edycja booster'],
      ['brazylijskie (Polish plural)', 'karty brazylijskie pokemon tcg'],
    ])('discards titles containing %s', (_label, title) => {
      expect(layer.execute(input(title))).toBeNull();
    });
  });

  // ── Real-world examples from the user ──

  describe('discards real-world non-English titles', () => {
    it('discards Spanish product with "(ES)" suffix', () => {
      // After normalization: "pokemon tcg scarlet violet sv 8 surging sparks sleeved booster spain es"
      expect(
        layer.execute(
          input('pokemon tcg scarlet violet sv 8 surging sparks sleeved booster spain es'),
        ),
      ).toBeNull();
    });

    it('discards German product with "(niemiecki)" suffix', () => {
      // After normalization: "pokemon tcg scarlet and violet surging sparks booster bundle 6 niemiecki"
      expect(
        layer.execute(
          input('pokemon tcg scarlet and violet surging sparks booster bundle 6 niemiecki'),
        ),
      ).toBeNull();
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

    it('does not match "it" as a standalone word (English pronoun)', () => {
      expect(layer.execute(input('pokemon tcg get it now booster box'))).not.toBeNull();
    });

    it('does not match "fr" inside longer words like "from" or "free"', () => {
      expect(layer.execute(input('pokemon tcg free shipping from warehouse'))).not.toBeNull();
    });

    it('does not match "de" inside longer words like "deluxe"', () => {
      expect(layer.execute(input('pokemon tcg deluxe edition booster box'))).not.toBeNull();
    });

    it('does not match "es" inside longer words like "best"', () => {
      expect(layer.execute(input('pokemon tcg best value booster box'))).not.toBeNull();
    });

    it('does not match "br" inside longer words like "brand"', () => {
      expect(layer.execute(input('pokemon tcg brand new booster box'))).not.toBeNull();
    });

    it('does not match "pt" inside longer words like "empty"', () => {
      expect(layer.execute(input('pokemon tcg empty booster box wrapper'))).not.toBeNull();
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
