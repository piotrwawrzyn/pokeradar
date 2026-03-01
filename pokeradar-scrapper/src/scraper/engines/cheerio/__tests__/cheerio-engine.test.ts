import axios, { AxiosError } from 'axios';
import { CheerioEngine } from '../cheerio-engine';
import { CheerioElement } from '../cheerio-element';
import { Selector, ShopConfig } from '@pokeradar/shared';

jest.mock('axios');
jest.mock('../../../../shared/utils', () => ({
  getProxyConfig: jest.fn().mockReturnValue(null),
}));
jest.mock('https-proxy-agent', () => ({
  HttpsProxyAgent: jest.fn().mockImplementation((url: string) => ({ url })),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { getProxyConfig } = jest.requireMock('../../../../shared/utils') as {
  getProxyConfig: jest.Mock;
};

const BASIC_HTML = `
  <html>
    <body>
      <div class="product" data-id="1">
        <span class="title">Booster Box</span>
        <a class="link" href="/product/1">Buy</a>
        <span class="price">149.99</span>
        <p class="stock">In Stock</p>
        <div class="data" data-info='{"available":true}'></div>
        <div class="multi" data-list='[{"qty":5},{"qty":0}]'></div>
        <div class="nested" data-deep='{"a":{"b":"yes"}}'></div>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    </body>
  </html>
`;

function makeShop(overrides: Partial<ShopConfig> = {}): ShopConfig {
  return {
    id: 'test-shop',
    name: 'Test Shop',
    baseUrl: 'https://test.com',
    searchUrl: 'https://test.com/search?q={query}',
    engine: 'cheerio',
    selectors: {
      searchPage: {
        article: { type: 'css', value: '.product' },
        productUrl: { type: 'css', value: '.link', extract: 'href' },
        title: { type: 'css', value: '.title' },
      },
      productPage: {
        price: { type: 'css', value: '.price' },
        available: [{ type: 'text', value: 'In Stock' }],
      },
    },
    ...overrides,
  } as ShopConfig;
}

function mockSuccessResponse(html: string, responseUrl?: string) {
  mockedAxios.get.mockResolvedValueOnce({
    data: html,
    request: { res: { responseUrl } },
  });
}

function makeAxiosError(status: number): AxiosError {
  const err = new Error(`HTTP ${status}`) as AxiosError;
  err.isAxiosError = true;
  err.response = { status, data: '', headers: {}, config: {} as never, statusText: '' };
  return err;
}

function makeNetworkError(): AxiosError {
  const err = new Error('Network error') as AxiosError;
  err.isAxiosError = true;
  err.response = undefined;
  return err;
}

function sel(
  value: string | string[],
  type: Selector['type'] = 'css',
  extract?: Selector['extract'],
): Selector {
  return { type, value, ...(extract ? { extract } : {}) };
}

beforeEach(() => {
  jest.clearAllMocks();
  getProxyConfig.mockReturnValue(null);
  delete process.env.MAX_RETRY_ATTEMPTS;
  // isAxiosError must reflect the error objects we build
  (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn((e) =>
    Boolean((e as AxiosError).isAxiosError),
  );
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── goto ────────────────────────────────────────────────────────────────────

describe('goto()', () => {
  it('loads HTML from a successful response', async () => {
    mockSuccessResponse(BASIC_HTML);
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
    expect(mockedAxios.get).toHaveBeenCalledWith('https://test.com/page', expect.any(Object));
  });

  it('sets currentUrl from the axios response URL', async () => {
    mockSuccessResponse(BASIC_HTML, 'https://test.com/redirected');
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
    expect(engine.getCurrentUrl()).toBe('https://test.com/redirected');
  });

  it('falls back to the original URL when no responseUrl is present', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: BASIC_HTML, request: { res: {} } });
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
    expect(engine.getCurrentUrl()).toBe('https://test.com/page');
  });

  it('retries once on a 429 response and succeeds on the second attempt', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    mockedAxios.get
      .mockRejectedValueOnce(makeAxiosError(429))
      .mockResolvedValueOnce({ data: BASIC_HTML, request: { res: {} } });

    const engine = new CheerioEngine(makeShop());
    const gotoPromise = engine.goto('https://test.com/page');
    // Advance past the 2s backoff timer
    await jest.advanceTimersByTimeAsync(3000);
    await gotoPromise;

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('retries on 403 and succeeds', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    mockedAxios.get
      .mockRejectedValueOnce(makeAxiosError(403))
      .mockResolvedValueOnce({ data: BASIC_HTML, request: { res: {} } });

    const engine = new CheerioEngine(makeShop());
    const gotoPromise = engine.goto('https://test.com/page');
    await jest.advanceTimersByTimeAsync(3000);
    await gotoPromise;

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 and succeeds', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    mockedAxios.get
      .mockRejectedValueOnce(makeAxiosError(500))
      .mockResolvedValueOnce({ data: BASIC_HTML, request: { res: {} } });

    const engine = new CheerioEngine(makeShop());
    const gotoPromise = engine.goto('https://test.com/page');
    await jest.advanceTimersByTimeAsync(3000);
    await gotoPromise;

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry on a 404 error', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    mockedAxios.get.mockRejectedValueOnce(makeAxiosError(404));
    const engine = new CheerioEngine(makeShop());
    await expect(engine.goto('https://test.com/page')).rejects.toThrow('HTTP 404');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (no response)', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    mockedAxios.get
      .mockRejectedValueOnce(makeNetworkError())
      .mockResolvedValueOnce({ data: BASIC_HTML, request: { res: {} } });

    const engine = new CheerioEngine(makeShop());
    const gotoPromise = engine.goto('https://test.com/page');
    await jest.advanceTimersByTimeAsync(3000);
    await gotoPromise;

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries (MAX_RETRY_ATTEMPTS=0 means no retry)', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '0';
    mockedAxios.get.mockRejectedValueOnce(makeAxiosError(429));
    const engine = new CheerioEngine(makeShop());
    await expect(engine.goto('https://test.com/page')).rejects.toThrow('HTTP 429');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('applies jittered delay when requestDelayMs is set', async () => {
    mockSuccessResponse(BASIC_HTML);
    const shop = makeShop({ antiBot: { requestDelayMs: 1000 } } as Partial<ShopConfig>);
    const engine = new CheerioEngine(shop);

    const gotoPromise = engine.goto('https://test.com/page');
    await jest.advanceTimersByTimeAsync(2000);
    await gotoPromise;

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('passes proxy agent to axios when proxy is configured', async () => {
    const { HttpsProxyAgent } = jest.requireMock('https-proxy-agent') as {
      HttpsProxyAgent: jest.Mock;
    };
    getProxyConfig.mockReturnValue({ url: 'http://proxy:8080' });
    mockSuccessResponse(BASIC_HTML);

    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');

    expect(HttpsProxyAgent).toHaveBeenCalledWith('http://proxy:8080');
    const callArgs = mockedAxios.get.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.httpsAgent).toBeDefined();
    getProxyConfig.mockReturnValue(null);
  });
});

// ─── getCurrentUrl ────────────────────────────────────────────────────────────

describe('getCurrentUrl()', () => {
  it('returns null before any goto() call', () => {
    const engine = new CheerioEngine(makeShop());
    expect(engine.getCurrentUrl()).toBeNull();
  });

  it('returns the URL after goto()', async () => {
    mockSuccessResponse(BASIC_HTML, 'https://test.com/product');
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/product');
    expect(engine.getCurrentUrl()).toBe('https://test.com/product');
  });
});

// ─── extract ─────────────────────────────────────────────────────────────────

describe('extract()', () => {
  let engine: CheerioEngine;

  beforeEach(async () => {
    mockSuccessResponse(BASIC_HTML);
    engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
  });

  it('throws when no page is loaded', async () => {
    const fresh = new CheerioEngine(makeShop());
    await expect(fresh.extract(sel('.title'))).rejects.toThrow('No page loaded');
  });

  it('returns text content for a CSS selector with extract=text', async () => {
    expect(await engine.extract(sel('.title', 'css', 'text'))).toBe('Booster Box');
  });

  it('returns text by default when extract is not specified', async () => {
    expect(await engine.extract(sel('.title'))).toBe('Booster Box');
  });

  it('returns href attribute for extract=href', async () => {
    expect(await engine.extract(sel('.link', 'css', 'href'))).toBe('/product/1');
  });

  it('returns innerHTML for extract=innerHTML', async () => {
    const html = await engine.extract(sel('.title', 'css', 'innerHTML'));
    expect(html).toBe('Booster Box');
  });

  it('returns ownText (direct text nodes only) for extract=ownText', async () => {
    expect(await engine.extract(sel('.price', 'css', 'ownText'))).toBe('149.99');
  });

  it('falls back to the second selector value when the first matches nothing', async () => {
    const result = await engine.extract(sel(['.nonexistent', '.title']));
    expect(result).toBe('Booster Box');
  });

  it('returns null when no selector value matches', async () => {
    expect(await engine.extract(sel(['.nope', '.also-nope']))).toBeNull();
  });

  it('uses case-insensitive text matching for type=text', async () => {
    expect(await engine.extract(sel('in stock', 'text', 'text'))).not.toBeNull();
    expect(await engine.extract(sel('IN STOCK', 'text', 'text'))).not.toBeNull();
  });

  it('returns null when text selector matches but element has no extractable value', async () => {
    // There is no href in the "In Stock" paragraph
    expect(await engine.extract(sel('in stock', 'text', 'href'))).toBeNull();
  });
});

// ─── extractAll ──────────────────────────────────────────────────────────────

describe('extractAll()', () => {
  let engine: CheerioEngine;

  beforeEach(async () => {
    mockSuccessResponse(BASIC_HTML);
    engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
  });

  it('throws when no page is loaded', async () => {
    const fresh = new CheerioEngine(makeShop());
    await expect(fresh.extractAll(sel('li'))).rejects.toThrow('No page loaded');
  });

  it('returns an array of CheerioElement instances', async () => {
    const items = await engine.extractAll(sel('li'));
    expect(items).toHaveLength(2);
    items.forEach((el) => expect(el).toBeInstanceOf(CheerioElement));
  });

  it('returns empty array when selector matches nothing', async () => {
    const items = await engine.extractAll(sel('.nonexistent'));
    expect(items).toHaveLength(0);
  });

  it('falls back to the second selector when the first matches nothing', async () => {
    const items = await engine.extractAll(sel(['.nonexistent', 'li']));
    expect(items).toHaveLength(2);
  });

  it('works with type=text selector', async () => {
    const items = await engine.extractAll(sel('item', 'text'));
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── exists ──────────────────────────────────────────────────────────────────

describe('exists()', () => {
  let engine: CheerioEngine;

  beforeEach(async () => {
    mockSuccessResponse(BASIC_HTML);
    engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
  });

  it('throws when no page is loaded', async () => {
    const fresh = new CheerioEngine(makeShop());
    await expect(fresh.exists(sel('.product'))).rejects.toThrow('No page loaded');
  });

  it('returns true when the CSS element exists', async () => {
    expect(await engine.exists(sel('.product'))).toBe(true);
  });

  it('returns false when the element does not exist', async () => {
    expect(await engine.exists(sel('.nonexistent'))).toBe(false);
  });

  it('returns true for a matching text selector', async () => {
    expect(await engine.exists(sel('In Stock', 'text'))).toBe(true);
  });

  it('returns false for a text selector with no match', async () => {
    expect(await engine.exists(sel('Out of Stock', 'text'))).toBe(false);
  });
});

// ─── existsJsonAttribute ─────────────────────────────────────────────────────

describe('exists() with type=json-attribute', () => {
  let engine: CheerioEngine;

  beforeEach(async () => {
    mockSuccessResponse(BASIC_HTML);
    engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
  });

  function jsonSel(
    value: string,
    attribute: string,
    jsonFilter: string,
    condition?: Selector['condition'],
    jsonExpect?: unknown,
  ): Selector {
    return { type: 'json-attribute', value, attribute, jsonFilter, condition, jsonExpect };
  }

  it('returns false when attribute is missing from selector config', async () => {
    expect(
      await engine.exists({ type: 'json-attribute', value: '.data', jsonFilter: 'available' }),
    ).toBe(false);
  });

  it('returns false when jsonFilter is missing from selector config', async () => {
    expect(
      await engine.exists({ type: 'json-attribute', value: '.data', attribute: 'data-info' }),
    ).toBe(false);
  });

  it('evaluates some condition (default) — truthy value', async () => {
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available'))).toBe(true);
  });

  it('evaluates some condition with multi-item array — at least one match', async () => {
    expect(await engine.exists(jsonSel('.multi', 'data-list', 'qty'))).toBe(true);
  });

  it('evaluates every condition — not all items truthy → false', async () => {
    expect(await engine.exists(jsonSel('.multi', 'data-list', 'qty', 'every'))).toBe(false);
  });

  it('evaluates none condition — at least one truthy → false', async () => {
    expect(await engine.exists(jsonSel('.multi', 'data-list', 'qty', 'none'))).toBe(false);
  });

  it('matches exact jsonExpect value', async () => {
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available', 'some', true))).toBe(
      true,
    );
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available', 'some', false))).toBe(
      false,
    );
  });

  it('handles nested dot-notation path', async () => {
    expect(await engine.exists(jsonSel('.nested', 'data-deep', 'a.b'))).toBe(true);
  });

  it('returns false when JSON parse fails', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: '<div class="bad" data-info="not-json"></div>',
      request: { res: {} },
    });
    const badEngine = new CheerioEngine(makeShop());
    await badEngine.goto('https://test.com/bad');
    expect(
      await badEngine.exists({
        type: 'json-attribute',
        value: '.bad',
        attribute: 'data-info',
        jsonFilter: 'x',
      }),
    ).toBe(false);
  });

  it('returns false when the element does not exist', async () => {
    expect(await engine.exists(jsonSel('.nonexistent', 'data-info', 'available'))).toBe(false);
  });
});

// ─── close ───────────────────────────────────────────────────────────────────

describe('close()', () => {
  it('clears state so subsequent extract() calls throw', async () => {
    mockSuccessResponse(BASIC_HTML);
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/page');
    await engine.close();
    await expect(engine.extract(sel('.title'))).rejects.toThrow('No page loaded');
  });

  it('sets getCurrentUrl() back to null', async () => {
    mockSuccessResponse(BASIC_HTML, 'https://test.com/product');
    const engine = new CheerioEngine(makeShop());
    await engine.goto('https://test.com/product');
    await engine.close();
    expect(engine.getCurrentUrl()).toBeNull();
  });

  it('can be called multiple times without error', async () => {
    const engine = new CheerioEngine(makeShop());
    await engine.close();
    await engine.close();
  });
});
