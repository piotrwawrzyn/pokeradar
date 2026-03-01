import { Locator } from 'playwright';
import { Selector } from '@pokeradar/shared';
import { PlaywrightElement } from '../playwright-element';

function sel(value: string | string[], type: Selector['type'] = 'css'): Selector {
  return { type, value };
}

/**
 * Builds a minimal mock Locator.
 * Each method can be overridden via the opts parameter.
 */
function makeMockLocator(
  opts: Partial<{
    textContent: string | null;
    innerHTML: string;
    getAttribute: string | null;
    allCount: number;
    andCount: number;
  }> = {},
): jest.Mocked<Locator> {
  const allCount = opts.allCount ?? 1;
  const stubbedElements = Array.from({ length: allCount }, () => ({})) as Locator[];

  // Use explicit key check so null is a valid override (not overridden by ?? default)
  const textContentValue = 'textContent' in opts ? opts.textContent : '  Hello  ';

  const mockLocator = {
    textContent: jest.fn().mockResolvedValue(textContentValue),
    innerHTML: jest.fn().mockResolvedValue(opts.innerHTML ?? 'Hello'),
    getAttribute: jest.fn().mockResolvedValue(opts.getAttribute ?? null),
    all: jest.fn().mockResolvedValue(stubbedElements),
    first: jest.fn(),
    nth: jest.fn(),
    locator: jest.fn(),
    getByText: jest.fn(),
    and: jest.fn(),
    count: jest.fn().mockResolvedValue(opts.andCount ?? 0),
    page: jest.fn(),
  } as unknown as jest.Mocked<Locator>;

  (mockLocator.nth as jest.Mock).mockReturnValue(mockLocator);
  (mockLocator.first as jest.Mock).mockReturnValue(mockLocator);
  (mockLocator.locator as jest.Mock).mockReturnValue(mockLocator);
  (mockLocator.getByText as jest.Mock).mockReturnValue(mockLocator);
  const andResult = { count: jest.fn().mockResolvedValue(opts.andCount ?? 0) };
  (mockLocator.and as jest.Mock).mockReturnValue(andResult);
  (mockLocator.page as jest.Mock).mockReturnValue({
    locator: jest.fn().mockReturnValue(mockLocator),
  });

  return mockLocator;
}

// ─── getText ─────────────────────────────────────────────────────────────────

describe('getText()', () => {
  it('returns trimmed text content', async () => {
    const locator = makeMockLocator({ textContent: '  Product Title  ' });
    const el = new PlaywrightElement(locator);
    expect(await el.getText()).toBe('Product Title');
  });

  it('returns null when textContent is whitespace only', async () => {
    const locator = makeMockLocator({ textContent: '   ' });
    const el = new PlaywrightElement(locator);
    expect(await el.getText()).toBeNull();
  });

  it('returns null when textContent is null', async () => {
    const locator = makeMockLocator({ textContent: null });
    const el = new PlaywrightElement(locator);
    expect(await el.getText()).toBeNull();
  });

  it('returns null when textContent throws', async () => {
    const locator = makeMockLocator();
    (locator.textContent as jest.Mock).mockRejectedValue(new Error('element detached'));
    expect(await new PlaywrightElement(locator).getText()).toBeNull();
  });
});

// ─── getOwnText ──────────────────────────────────────────────────────────────

describe('getOwnText()', () => {
  it('returns text with child elements stripped', async () => {
    const locator = makeMockLocator({
      innerHTML: 'Direct text <span>Child</span> more text',
    });
    const el = new PlaywrightElement(locator);
    const text = await el.getOwnText();
    expect(text).toContain('Direct text');
    expect(text).toContain('more text');
    expect(text).not.toContain('<span>');
    expect(text).not.toContain('Child');
  });

  it('returns null when all content is inside child elements', async () => {
    const locator = makeMockLocator({ innerHTML: '<span>Child only</span>' });
    expect(await new PlaywrightElement(locator).getOwnText()).toBeNull();
  });

  it('returns null when innerHTML throws', async () => {
    const locator = makeMockLocator();
    (locator.innerHTML as jest.Mock).mockRejectedValue(new Error('fail'));
    expect(await new PlaywrightElement(locator).getOwnText()).toBeNull();
  });
});

// ─── getAttribute ─────────────────────────────────────────────────────────────

describe('getAttribute()', () => {
  it('returns the attribute value', async () => {
    const locator = makeMockLocator({ getAttribute: '/product/42' });
    expect(await new PlaywrightElement(locator).getAttribute('href')).toBe('/product/42');
  });

  it('returns null when attribute is absent', async () => {
    const locator = makeMockLocator({ getAttribute: null });
    expect(await new PlaywrightElement(locator).getAttribute('data-missing')).toBeNull();
  });

  it('returns null when getAttribute throws', async () => {
    const locator = makeMockLocator();
    (locator.getAttribute as jest.Mock).mockRejectedValue(new Error('fail'));
    expect(await new PlaywrightElement(locator).getAttribute('href')).toBeNull();
  });
});

// ─── find ─────────────────────────────────────────────────────────────────────

describe('find()', () => {
  it('returns a PlaywrightElement when a CSS descendant is found', async () => {
    const locator = makeMockLocator({ allCount: 1 });
    const found = await new PlaywrightElement(locator).find(sel('.child'));
    expect(found).toBeInstanceOf(PlaywrightElement);
  });

  it('returns null when no CSS descendant matches', async () => {
    const locator = makeMockLocator({ allCount: 0 });
    expect(await new PlaywrightElement(locator).find(sel('.nonexistent'))).toBeNull();
  });

  it('uses getByText with regex for type=text selector', async () => {
    const locator = makeMockLocator({ allCount: 1 });
    await new PlaywrightElement(locator).find(sel('in stock', 'text'));
    expect(locator.getByText).toHaveBeenCalledWith(new RegExp('in stock', 'i'));
  });

  it('tries each array value and returns first match', async () => {
    const locator = makeMockLocator();
    (locator.locator as jest.Mock)
      .mockReturnValueOnce({ all: jest.fn().mockResolvedValue([]), first: jest.fn() })
      .mockReturnValueOnce({
        all: jest.fn().mockResolvedValue([{}]),
        first: jest.fn().mockReturnValue(locator),
      });

    const found = await new PlaywrightElement(locator).find(sel(['.bad', '.good']));
    expect(found).toBeInstanceOf(PlaywrightElement);
  });

  it('returns null when an exception is thrown', async () => {
    const locator = makeMockLocator();
    (locator.locator as jest.Mock).mockImplementation(() => {
      throw new Error('unexpected');
    });
    expect(await new PlaywrightElement(locator).find(sel('.child'))).toBeNull();
  });
});

// ─── findAll ──────────────────────────────────────────────────────────────────

describe('findAll()', () => {
  it('returns an array of PlaywrightElements for CSS selector', async () => {
    const locator = makeMockLocator({ allCount: 3 });
    const results = await new PlaywrightElement(locator).findAll(sel('li'));
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r).toBeInstanceOf(PlaywrightElement));
  });

  it('returns empty array when nothing matches', async () => {
    const locator = makeMockLocator({ allCount: 0 });
    expect(await new PlaywrightElement(locator).findAll(sel('.nope'))).toHaveLength(0);
  });

  it('uses getByText with regex for type=text selector', async () => {
    const locator = makeMockLocator({ allCount: 2 });
    await new PlaywrightElement(locator).findAll(sel('stock', 'text'));
    expect(locator.getByText).toHaveBeenCalledWith(new RegExp('stock', 'i'));
  });

  it('uses first value when selector is an array', async () => {
    const locator = makeMockLocator({ allCount: 1 });
    await new PlaywrightElement(locator).findAll(sel(['.first', '.second']));
    expect(locator.locator).toHaveBeenCalledWith('.first');
  });

  it('returns empty array when an exception is thrown', async () => {
    const locator = makeMockLocator();
    (locator.locator as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });
    expect(await new PlaywrightElement(locator).findAll(sel('.bad'))).toEqual([]);
  });
});

// ─── matches ──────────────────────────────────────────────────────────────────

describe('matches()', () => {
  it('returns true when locator.and().count() > 0', async () => {
    const locator = makeMockLocator({ andCount: 1 });
    expect(await new PlaywrightElement(locator).matches(sel('.product'))).toBe(true);
  });

  it('returns false when locator.and().count() === 0', async () => {
    const locator = makeMockLocator({ andCount: 0 });
    expect(await new PlaywrightElement(locator).matches(sel('.other'))).toBe(false);
  });

  it('returns false when an exception is thrown', async () => {
    const locator = makeMockLocator();
    (locator.and as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });
    expect(await new PlaywrightElement(locator).matches(sel('.product'))).toBe(false);
  });

  it('uses first value from array selector', async () => {
    const locator = makeMockLocator({ andCount: 1 });
    expect(await new PlaywrightElement(locator).matches(sel(['.a', '.b']))).toBe(true);
  });
});
