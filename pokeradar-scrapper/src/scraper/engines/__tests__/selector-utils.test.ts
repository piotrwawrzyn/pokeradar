import * as cheerio from 'cheerio';
import { Selector } from '@pokeradar/shared';
import {
  normalizeSelectors,
  getFirstSelector,
  trySelectors,
  findByTextInsensitive,
} from '../selector-utils';

function sel(value: string | string[], type: Selector['type'] = 'css'): Selector {
  return { type, value };
}

describe('normalizeSelectors', () => {
  it('wraps a single string in an array', () => {
    expect(normalizeSelectors(sel('.foo'))).toEqual(['.foo']);
  });

  it('returns an array unchanged', () => {
    expect(normalizeSelectors(sel(['.foo', '.bar']))).toEqual(['.foo', '.bar']);
  });

  it('returns an empty array when value is an empty array', () => {
    expect(normalizeSelectors(sel([]))).toEqual([]);
  });
});

describe('getFirstSelector', () => {
  it('returns the string directly when value is a string', () => {
    expect(getFirstSelector(sel('.foo'))).toBe('.foo');
  });

  it('returns the first element when value is an array', () => {
    expect(getFirstSelector(sel(['.first', '.second']))).toBe('.first');
  });

  it('returns the only element when array has one item', () => {
    expect(getFirstSelector(sel(['.only']))).toBe('.only');
  });
});

describe('trySelectors', () => {
  it('returns the result of the first successful selector', async () => {
    const result = await trySelectors(['.a', '.b'], async (s) => (s === '.a' ? 'hit' : null));
    expect(result).toBe('hit');
  });

  it('skips null results and returns the next success', async () => {
    const result = await trySelectors(['.a', '.b'], async (s) => (s === '.b' ? 'second' : null));
    expect(result).toBe('second');
  });

  it('returns null when all selectors produce null', async () => {
    const result = await trySelectors(['.a', '.b'], async () => null);
    expect(result).toBeNull();
  });

  it('returns null when array is empty', async () => {
    const result = await trySelectors([], async () => 'value');
    expect(result).toBeNull();
  });

  it('catches thrown errors and calls onError callback', async () => {
    const onError = jest.fn();
    const result = await trySelectors(
      ['.bad', '.good'],
      async (s) => {
        if (s === '.bad') throw new Error('boom');
        return 'ok';
      },
      onError,
    );
    expect(result).toBe('ok');
    expect(onError).toHaveBeenCalledWith('.bad', expect.any(Error));
  });

  it('returns null when all selectors throw', async () => {
    const result = await trySelectors(['.a', '.b'], async () => {
      throw new Error('fail');
    });
    expect(result).toBeNull();
  });

  it('does not throw when no onError callback is provided and a selector throws', async () => {
    await expect(
      trySelectors(['.bad'], async () => {
        throw new Error('boom');
      }),
    ).resolves.toBeNull();
  });

  it('returns the first non-null result and does not try later selectors', async () => {
    const tryFn = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const result = await trySelectors(['.a', '.b'], tryFn);
    expect(result).toBe('first');
    expect(tryFn).toHaveBeenCalledTimes(1);
  });
});

describe('findByTextInsensitive', () => {
  const HTML = `
    <div>
      <span class="a">Hello World</span>
      <p class="b">HELLO UPPERCASE</p>
      <em class="c">Something else</em>
    </div>
  `;

  let $: cheerio.CheerioAPI;
  beforeEach(() => {
    $ = cheerio.load(HTML);
  });

  it('finds elements whose text includes the value (case-insensitive)', () => {
    const result = findByTextInsensitive($, $.root(), 'hello');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('matches regardless of case', () => {
    const lower = findByTextInsensitive($, $.root(), 'hello world');
    const upper = findByTextInsensitive($, $.root(), 'HELLO WORLD');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBeGreaterThan(0);
  });

  it('returns empty result when no elements match', () => {
    const result = findByTextInsensitive($, $.root(), 'nonexistent-xyz');
    expect(result.length).toBe(0);
  });

  it('searches within a scoped root element', () => {
    const scopedRoot = $('div');
    const result = findByTextInsensitive($, scopedRoot, 'something else');
    expect(result.length).toBeGreaterThan(0);
  });

  it('matches on partial substrings', () => {
    const result = findByTextInsensitive($, $.root(), 'world');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a Cheerio collection (supports .each and .first)', () => {
    const result = findByTextInsensitive($, $.root(), 'hello');
    expect(typeof result.each).toBe('function');
    expect(typeof result.first).toBe('function');
  });

  it('does not match elements outside the scoped root', () => {
    // Scope to .a only — should not find text from .b or .c
    const scopedRoot = $('span.a');
    const result = findByTextInsensitive($, scopedRoot, 'HELLO UPPERCASE');
    expect(result.length).toBe(0);
  });
});
