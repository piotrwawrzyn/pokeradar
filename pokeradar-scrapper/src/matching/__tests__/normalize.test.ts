import { NormalizeLayer, normalizeTitle } from '../layers/normalize';

describe('normalizeTitle', () => {
  it('lowercases the title', () => {
    expect(normalizeTitle('Apple iPhone 14 PRO Max')).toBe('apple iphone 14 pro max');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeTitle('  apple   iphone  14  ')).toBe('apple iphone 14');
  });

  it('replaces Polish characters', () => {
    expect(normalizeTitle('Maślak róża')).toBe('maslak roza');
  });

  it('replaces all Polish diacritics', () => {
    expect(normalizeTitle('ąćęłńóśźż')).toBe('acelnoszz');
  });

  it('replaces German characters', () => {
    expect(normalizeTitle('Ärger Öl Über Straße')).toBe('arger ol uber strasse');
  });

  it('replaces French characters', () => {
    expect(normalizeTitle('café résumé naïve')).toBe('cafe resume naive');
  });

  it('normalizes em-dash and en-dash to spaces', () => {
    expect(normalizeTitle('Scarlet—Violet')).toBe('scarlet violet');
    expect(normalizeTitle('Scarlet–Violet')).toBe('scarlet violet');
  });

  it('replaces colons with spaces', () => {
    expect(normalizeTitle('Pokemon: Surging Sparks')).toBe('pokemon surging sparks');
  });

  it('replaces hyphens with spaces', () => {
    expect(normalizeTitle('booster-box')).toBe('booster box');
  });

  it('replaces ampersands with spaces', () => {
    expect(normalizeTitle('Scarlet & Violet')).toBe('scarlet violet');
  });

  it('replaces slashes and plus signs with spaces', () => {
    expect(normalizeTitle('Pack/Bundle')).toBe('pack bundle');
    expect(normalizeTitle('2+1 Free')).toBe('2 1 free');
  });

  it('handles combined normalizations', () => {
    expect(normalizeTitle('  Pokémon TCG: Surging–Sparks  BOOSTER  Box  ')).toBe(
      'pokemon tcg surging sparks booster box',
    );
  });

  it('is idempotent', () => {
    const input = 'Pokémon TCG: Surging–Sparks BOOSTER Box';
    const first = normalizeTitle(input);
    const second = normalizeTitle(first);
    expect(first).toBe(second);
  });

  it('preserves numbers', () => {
    expect(normalizeTitle('151 Booster Bundle')).toBe('151 booster bundle');
  });

  it('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });
});

describe('NormalizeLayer', () => {
  const layer = new NormalizeLayer();

  it('returns normalized title for valid input', () => {
    const result = layer.execute({ rawTitle: 'Surging Sparks Booster Box' });
    expect(result).toEqual({
      raw: 'Surging Sparks Booster Box',
      normalized: 'surging sparks booster box',
    });
  });

  it('returns null for very short titles', () => {
    expect(layer.execute({ rawTitle: 'ab' })).toBeNull();
    expect(layer.execute({ rawTitle: '  ' })).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(layer.execute({ rawTitle: '' })).toBeNull();
  });

  it('accepts titles that are exactly 3 chars after normalization', () => {
    const result = layer.execute({ rawTitle: 'Box' });
    expect(result).not.toBeNull();
    expect(result!.normalized).toBe('box');
  });

  it('preserves the raw title in output', () => {
    const raw = '  Pokémon TCG: Ärger  ';
    const result = layer.execute({ rawTitle: raw });
    expect(result!.raw).toBe(raw);
  });
});
