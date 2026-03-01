import { Browser, Page, BrowserContext, Locator } from 'playwright';
import { Selector, ShopConfig } from '@pokeradar/shared';
import { PlaywrightEngine } from '../playwright-engine';
import { PlaywrightElement } from '../playwright-element';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../../../shared/utils', () => ({
  getProxyConfig: jest.fn().mockReturnValue(null),
}));
jest.mock('../../../../shared/utils/safe-close', () => ({
  safeClose: jest.fn().mockResolvedValue(undefined),
}));

const { getProxyConfig } = jest.requireMock('../../../../shared/utils') as {
  getProxyConfig: jest.Mock;
};

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeMockLocator(): jest.Mocked<Locator> {
  const locator = {
    all: jest.fn().mockResolvedValue([{}]),
    first: jest.fn(),
    nth: jest.fn(),
    getAttribute: jest.fn().mockResolvedValue(null),
    textContent: jest.fn().mockResolvedValue('some text'),
    innerHTML: jest.fn().mockResolvedValue('some text'),
  } as unknown as jest.Mocked<Locator>;
  (locator.first as jest.Mock).mockReturnValue(locator);
  (locator.nth as jest.Mock).mockReturnValue(locator);
  return locator;
}

function makeMockPage(): jest.Mocked<Page> {
  const locator = makeMockLocator();

  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    setDefaultTimeout: jest.fn(),
    setDefaultNavigationTimeout: jest.fn(),
    route: jest.fn().mockResolvedValue(undefined),
    url: jest.fn().mockReturnValue('https://test.com/page'),
    locator: jest.fn().mockReturnValue(locator),
    getByText: jest.fn().mockReturnValue(locator),
    isClosed: jest.fn().mockReturnValue(false),
  } as unknown as jest.Mocked<Page>;

  return page;
}

function makeMockContext(page: Page): jest.Mocked<BrowserContext> {
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BrowserContext>;
}

function makeMockBrowser(context: BrowserContext): jest.Mocked<Browser> {
  return {
    newContext: jest.fn().mockResolvedValue(context),
    close: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
  } as unknown as jest.Mocked<Browser>;
}

// Playwright module mock — chromium.launch is re-set per test
jest.mock('playwright', () => ({
  chromium: { launch: jest.fn() },
  Browser: class {},
  Page: class {},
  BrowserContext: class {},
  Locator: class {},
}));

const { chromium } = jest.requireMock('playwright') as { chromium: { launch: jest.Mock } };

function makeShop(overrides: Partial<ShopConfig> = {}): ShopConfig {
  return {
    id: 'test-shop',
    name: 'Test Shop',
    baseUrl: 'https://test.com',
    searchUrl: 'https://test.com/search?q={query}',
    engine: 'playwright',
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

function sel(
  value: string | string[],
  type: Selector['type'] = 'css',
  extract?: Selector['extract'],
): Selector {
  return { type, value, ...(extract ? { extract } : {}) };
}

/** Creates a fresh page+context+browser mock triple and sets it on chromium.launch. */
function setupMockBrowserChain(): {
  mockPage: jest.Mocked<Page>;
  mockContext: jest.Mocked<BrowserContext>;
  mockBrowser: jest.Mocked<Browser>;
} {
  const mockPage = makeMockPage();
  const mockContext = makeMockContext(mockPage);
  const mockBrowser = makeMockBrowser(mockContext);
  chromium.launch.mockResolvedValue(mockBrowser);
  return { mockPage, mockContext, mockBrowser };
}

/** Creates an engine and calls goto(), advancing timers to unblock any delays. */
async function gotoWithFakeTimers(engine: PlaywrightEngine, url: string): Promise<void> {
  const promise = engine.goto(url);
  await jest.runAllTimersAsync();
  await promise;
}

beforeEach(() => {
  jest.clearAllMocks();
  getProxyConfig.mockReturnValue(null);
  delete process.env.MAX_RETRY_ATTEMPTS;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── initializePage (tested via goto) ────────────────────────────────────────

describe('initializePage() via goto()', () => {
  it('launches own browser when no shared browser is provided', async () => {
    const { mockBrowser } = setupMockBrowserChain();
    void mockBrowser;
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('uses shared browser context when provided and no proxy', async () => {
    const mockPage = makeMockPage();
    const mockContext = makeMockContext(mockPage);
    const mockBrowser = makeMockBrowser(mockContext);

    const engine = new PlaywrightEngine(makeShop(), mockBrowser as unknown as Browser);
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    expect(chromium.launch).not.toHaveBeenCalled();
    expect(mockBrowser.newContext).toHaveBeenCalled();
  });

  it('throws when shared browser is disconnected', async () => {
    const mockPage = makeMockPage();
    const mockBrowser = makeMockBrowser(makeMockContext(mockPage));
    (mockBrowser.isConnected as jest.Mock).mockReturnValue(false);

    const engine = new PlaywrightEngine(makeShop(), mockBrowser as unknown as Browser);
    await expect(engine.goto('https://test.com/page')).rejects.toThrow(
      'Shared browser is already closed',
    );
  });

  it('launches own browser even when shared browser is provided if proxy is configured', async () => {
    getProxyConfig.mockReturnValue({ host: 'proxy', port: 8080, username: 'u', password: 'p' });
    setupMockBrowserChain();

    const sharedBrowser = makeMockBrowser(makeMockContext(makeMockPage()));
    const engine = new PlaywrightEngine(makeShop(), sharedBrowser as unknown as Browser);
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({ proxy: expect.any(Object) }),
    );
    expect(sharedBrowser.newContext).not.toHaveBeenCalled();
  });

  it('sets default timeouts on the page', async () => {
    const { mockPage } = setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(500);
    expect(mockPage.setDefaultNavigationTimeout).toHaveBeenCalledWith(10000);
  });

  it('sets up route handler for resource blocking', async () => {
    const { mockPage } = setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(mockPage.route).toHaveBeenCalledWith('**/*', expect.any(Function));
  });
});

// ─── goto ─────────────────────────────────────────────────────────────────────

describe('goto()', () => {
  it('calls page.goto() with networkidle wait strategy', async () => {
    const { mockPage } = setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    expect(mockPage.goto).toHaveBeenCalledWith('https://test.com/page', {
      waitUntil: 'networkidle',
      timeout: 10000,
    });
  });

  it('calls page.waitForTimeout(100) after navigation', async () => {
    const { mockPage } = setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(mockPage.waitForTimeout).toHaveBeenCalledWith(100);
  });

  it('retries on navigation failure and succeeds on second attempt', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '1';
    const { mockPage } = setupMockBrowserChain();
    (mockPage.goto as jest.Mock)
      .mockRejectedValueOnce(new Error('Navigation timeout'))
      .mockResolvedValueOnce(undefined);

    const engine = new PlaywrightEngine(makeShop());
    const promise = engine.goto('https://test.com/page');
    await jest.runAllTimersAsync();
    await promise;

    expect(mockPage.goto).toHaveBeenCalledTimes(2);
  });

  it('throws immediately when MAX_RETRY_ATTEMPTS=0 and navigation fails', async () => {
    process.env.MAX_RETRY_ATTEMPTS = '0';
    const { mockPage } = setupMockBrowserChain();
    (mockPage.goto as jest.Mock).mockRejectedValueOnce(new Error('Navigation timeout'));

    const engine = new PlaywrightEngine(makeShop());
    await expect(engine.goto('https://test.com/page')).rejects.toThrow('Navigation timeout');
    expect(mockPage.goto).toHaveBeenCalledTimes(1);
  });

  it('applies jittered delay when requestDelayMs is set', async () => {
    const { mockPage } = setupMockBrowserChain();
    const shop = makeShop({ antiBot: { requestDelayMs: 500 } } as Partial<ShopConfig>);
    const engine = new PlaywrightEngine(shop);
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(mockPage.goto).toHaveBeenCalled();
  });
});

// ─── getCurrentUrl ────────────────────────────────────────────────────────────

describe('getCurrentUrl()', () => {
  it('returns null before goto() is called', () => {
    expect(new PlaywrightEngine(makeShop()).getCurrentUrl()).toBeNull();
  });

  it('returns the page URL after goto()', async () => {
    const { mockPage } = setupMockBrowserChain();
    (mockPage.url as jest.Mock).mockReturnValue('https://test.com/redirected');
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(engine.getCurrentUrl()).toBe('https://test.com/redirected');
  });
});

// ─── extract ──────────────────────────────────────────────────────────────────

describe('extract()', () => {
  it('throws when no page is loaded', async () => {
    await expect(new PlaywrightEngine(makeShop()).extract(sel('.title'))).rejects.toThrow(
      'No page loaded',
    );
  });

  it('returns text content for CSS selector', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.textContent as jest.Mock).mockResolvedValue('  149.99  ');
    (locator.all as jest.Mock).mockResolvedValue([{}]);
    (locator.first as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel('.price', 'css', 'text'))).toBe('149.99');
  });

  it('returns href attribute for extract=href', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.getAttribute as jest.Mock).mockResolvedValue('/product/1');
    (locator.all as jest.Mock).mockResolvedValue([{}]);
    (locator.first as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel('.link', 'css', 'href'))).toBe('/product/1');
  });

  it('falls back to second selector when first returns no elements', async () => {
    const { mockPage } = setupMockBrowserChain();
    const emptyLocator = { all: jest.fn().mockResolvedValue([]), first: jest.fn() };
    const hitLocator = {
      all: jest.fn().mockResolvedValue([{}]),
      first: jest.fn(),
      textContent: jest.fn().mockResolvedValue('Found'),
    };
    (hitLocator.first as jest.Mock).mockReturnValue(hitLocator);
    (mockPage.locator as jest.Mock)
      .mockReturnValueOnce(emptyLocator)
      .mockReturnValueOnce(hitLocator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel(['.bad', '.good'], 'css', 'text'))).toBe('Found');
  });

  it('returns null when no selector matches', async () => {
    const { mockPage } = setupMockBrowserChain();
    (mockPage.locator as jest.Mock).mockReturnValue({ all: jest.fn().mockResolvedValue([]) });

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel(['.a', '.b']))).toBeNull();
  });

  it('returns innerHTML for extract=innerHTML', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.innerHTML as jest.Mock).mockResolvedValue('<b>bold</b>');
    (locator.all as jest.Mock).mockResolvedValue([{}]);
    (locator.first as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel('.desc', 'css', 'innerHTML'))).toBe('<b>bold</b>');
  });

  it('returns ownText (direct text nodes only) for extract=ownText', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.innerHTML as jest.Mock).mockResolvedValue('Price: <span>149</span>.99');
    (locator.all as jest.Mock).mockResolvedValue([{}]);
    (locator.first as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extract(sel('.price', 'css', 'ownText'))).toBe('Price: .99');
  });

  it('uses xpath= prefix when extracting with type=xpath', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.textContent as jest.Mock).mockResolvedValue('XPath result');
    (locator.all as jest.Mock).mockResolvedValue([{}]);
    (locator.first as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    await engine.extract(sel('//h1', 'xpath', 'text'));
    expect(mockPage.locator).toHaveBeenCalledWith('xpath=//h1');
  });
});

// ─── extractAll ───────────────────────────────────────────────────────────────

describe('extractAll()', () => {
  it('throws when no page is loaded', async () => {
    await expect(new PlaywrightEngine(makeShop()).extractAll(sel('li'))).rejects.toThrow(
      'No page loaded',
    );
  });

  it('returns an array of PlaywrightElements', async () => {
    const { mockPage } = setupMockBrowserChain();
    const locator = makeMockLocator();
    (locator.all as jest.Mock).mockResolvedValue([{}, {}, {}]);
    (locator.nth as jest.Mock).mockReturnValue(locator);
    (mockPage.locator as jest.Mock).mockReturnValue(locator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    const results = await engine.extractAll(sel('li'));
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r).toBeInstanceOf(PlaywrightElement));
  });

  it('returns empty array when no elements are found', async () => {
    const { mockPage } = setupMockBrowserChain();
    (mockPage.locator as jest.Mock).mockReturnValue({ all: jest.fn().mockResolvedValue([]) });

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extractAll(sel('.empty'))).toHaveLength(0);
  });

  it('falls back to second selector', async () => {
    const { mockPage } = setupMockBrowserChain();
    const emptyLocator = { all: jest.fn().mockResolvedValue([]) };
    const hitLocator = {
      all: jest.fn().mockResolvedValue([{}, {}]),
      nth: jest.fn().mockReturnThis(),
    };
    (mockPage.locator as jest.Mock)
      .mockReturnValueOnce(emptyLocator)
      .mockReturnValueOnce(hitLocator);

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.extractAll(sel(['.bad', '.good']))).toHaveLength(2);
  });
});

// ─── exists ───────────────────────────────────────────────────────────────────

describe('exists()', () => {
  it('throws when no page is loaded', async () => {
    await expect(new PlaywrightEngine(makeShop()).exists(sel('.product'))).rejects.toThrow(
      'No page loaded',
    );
  });

  it('returns true when selector finds elements', async () => {
    const { mockPage } = setupMockBrowserChain();
    (mockPage.locator as jest.Mock).mockReturnValue({ all: jest.fn().mockResolvedValue([{}]) });

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.exists(sel('.product'))).toBe(true);
  });

  it('returns false when selector finds nothing', async () => {
    const { mockPage } = setupMockBrowserChain();
    (mockPage.locator as jest.Mock).mockReturnValue({ all: jest.fn().mockResolvedValue([]) });

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    expect(await engine.exists(sel('.ghost'))).toBe(false);
  });
});

// ─── existsJsonAttribute ──────────────────────────────────────────────────────

describe('exists() with type=json-attribute', () => {
  function jsonSel(
    value: string,
    attribute: string,
    jsonFilter: string,
    condition?: Selector['condition'],
    jsonExpect?: unknown,
  ): Selector {
    return { type: 'json-attribute', value, attribute, jsonFilter, condition, jsonExpect };
  }

  async function setupWithJsonAttribute(raw: string | null): Promise<PlaywrightEngine> {
    const { mockPage } = setupMockBrowserChain();
    const innerLocator = { getAttribute: jest.fn().mockResolvedValue(raw) };
    (mockPage.locator as jest.Mock).mockReturnValue({
      first: jest.fn().mockReturnValue(innerLocator),
    });

    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    return engine;
  }

  it('returns false when attribute is not in selector config', async () => {
    const engine = await setupWithJsonAttribute(null);
    expect(
      await engine.exists({ type: 'json-attribute', value: '.data', jsonFilter: 'available' }),
    ).toBe(false);
  });

  it('returns false when jsonFilter is not in selector config', async () => {
    const engine = await setupWithJsonAttribute(null);
    expect(
      await engine.exists({ type: 'json-attribute', value: '.data', attribute: 'data-info' }),
    ).toBe(false);
  });

  it('returns false when the element attribute is null', async () => {
    const engine = await setupWithJsonAttribute(null);
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available'))).toBe(false);
  });

  it('evaluates some condition (default) — truthy value', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify({ available: true }));
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available'))).toBe(true);
  });

  it('evaluates every condition — all items truthy', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify([{ qty: 5 }, { qty: 3 }]));
    expect(await engine.exists(jsonSel('.data', 'data-list', 'qty', 'every'))).toBe(true);
  });

  it('evaluates every condition — not all items truthy → false', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify([{ qty: 5 }, { qty: 0 }]));
    expect(await engine.exists(jsonSel('.data', 'data-list', 'qty', 'every'))).toBe(false);
  });

  it('evaluates none condition — no items truthy', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify([{ qty: 0 }, { qty: 0 }]));
    expect(await engine.exists(jsonSel('.data', 'data-list', 'qty', 'none'))).toBe(true);
  });

  it('matches exact jsonExpect value', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify({ status: 'in_stock' }));
    expect(await engine.exists(jsonSel('.data', 'data-info', 'status', 'some', 'in_stock'))).toBe(
      true,
    );
    expect(
      await engine.exists(jsonSel('.data', 'data-info', 'status', 'some', 'out_of_stock')),
    ).toBe(false);
  });

  it('handles nested dot-notation path', async () => {
    const engine = await setupWithJsonAttribute(JSON.stringify({ a: { b: 'yes' } }));
    expect(await engine.exists(jsonSel('.data', 'data-deep', 'a.b'))).toBe(true);
  });

  it('returns false when JSON parse fails', async () => {
    const engine = await setupWithJsonAttribute('not-valid-json');
    expect(await engine.exists(jsonSel('.data', 'data-info', 'available'))).toBe(false);
  });
});

// ─── close ────────────────────────────────────────────────────────────────────

describe('close()', () => {
  const { safeClose } = jest.requireMock('../../../../shared/utils/safe-close') as {
    safeClose: jest.Mock;
  };

  it('closes page, context, and browser when engine owns the browser', async () => {
    setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    await engine.close();
    expect(safeClose).toHaveBeenCalledTimes(3); // page, context, browser
  });

  it('closes only page and context when browser is shared', async () => {
    safeClose.mockClear();
    const mockPage = makeMockPage();
    const mockBrowser = makeMockBrowser(makeMockContext(mockPage));

    const engine = new PlaywrightEngine(makeShop(), mockBrowser as unknown as Browser);
    await gotoWithFakeTimers(engine, 'https://test.com/page');

    await engine.close();
    expect(safeClose).toHaveBeenCalledTimes(2); // page + context only
  });

  it('can be called multiple times without error', async () => {
    const engine = new PlaywrightEngine(makeShop());
    await engine.close();
    await engine.close();
  });

  it('makes extract() throw after close', async () => {
    setupMockBrowserChain();
    const engine = new PlaywrightEngine(makeShop());
    await gotoWithFakeTimers(engine, 'https://test.com/page');
    await engine.close();
    await expect(engine.extract(sel('.title'))).rejects.toThrow('No page loaded');
  });
});

// ─── resource blocking ────────────────────────────────────────────────────────

type FakeRoute = {
  request: () => { resourceType: () => string; url: () => string };
  abort: jest.Mock;
  continue: jest.Mock;
};

function makeRoute(resourceType: string, url: string): FakeRoute {
  return {
    request: () => ({ resourceType: () => resourceType, url: () => url }),
    abort: jest.fn(),
    continue: jest.fn(),
  };
}

async function captureRouteHandler(): Promise<(route: FakeRoute) => void> {
  let handler!: (route: FakeRoute) => void;
  const { mockPage } = setupMockBrowserChain();
  (mockPage.route as jest.Mock).mockImplementation((_pattern, h) => {
    handler = h;
  });
  const engine = new PlaywrightEngine(makeShop());
  await gotoWithFakeTimers(engine, 'https://test.com/page');
  return handler;
}

describe('resource blocking', () => {
  it('aborts image requests', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('image', 'https://test.com/img.png');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
    expect(route.continue).not.toHaveBeenCalled();
  });

  it('aborts stylesheet requests', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('stylesheet', 'https://test.com/style.css');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
  });

  it('aborts font requests', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('font', 'https://test.com/font.woff2');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
  });

  it('aborts media requests', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('media', 'https://test.com/video.mp4');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
  });

  it('aborts requests to blocked analytics domains', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('script', 'https://www.google-analytics.com/ga.js');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
  });

  it('aborts requests to hotjar', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('script', 'https://static.hotjar.com/c/hotjar.js');
    handler(route);
    expect(route.abort).toHaveBeenCalled();
  });

  it('continues non-blocked requests', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('document', 'https://test.com/page');
    handler(route);
    expect(route.continue).toHaveBeenCalled();
    expect(route.abort).not.toHaveBeenCalled();
  });

  it('continues XHR requests to non-blocked domains', async () => {
    const handler = await captureRouteHandler();
    const route = makeRoute('xhr', 'https://api.test.com/products');
    handler(route);
    expect(route.continue).toHaveBeenCalled();
  });
});
