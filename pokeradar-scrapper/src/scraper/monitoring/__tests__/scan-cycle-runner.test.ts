/**
 * ScanCycleRunner unit tests.
 *
 * The runner coordinates two phases per shop:
 *   Phase 1 — extract candidates via navigator, run pipeline match, build tasks
 *   Phase 2 — visit product pages or use search-page data, dispatch results
 *
 * Mocks: IScraperFactory, IScraper, SearchNavigator, ProductMatchingPipeline,
 *        ResultBuffer, IMultiUserDispatcher, playwright (for Playwright cycle).
 */

import { Browser } from 'playwright';
import { ShopConfig, ProductResult } from '@pokeradar/shared';
import { WatchlistProductInternal } from '../../../shared/types';
import { SetGroup } from '../../../shared/utils/product-utils';
import { ProductCandidate } from '../../scrapers/base/helpers/candidate-selector';
import { IScraper } from '../../scrapers/base/base-scraper';
import {
  ScanCycleRunner,
  ScanCycleConfig,
  IScraperFactory,
  IMultiUserDispatcher,
} from '../scan-cycle-runner';
import { ResultBuffer } from '../result-buffer';
import {
  ProductMatchingPipeline,
  MatchResult,
  MatchableProductType,
  MatchableProductSet,
} from '../../../matching';

type MockScraper = jest.Mocked<IScraper>;

// ─── Playwright mock ─────────────────────────────────────────────────────────

const mockBrowserClose = jest.fn().mockResolvedValue(undefined);
const mockBrowserObj = { close: mockBrowserClose } as unknown as Browser;

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeShop(id: string, engine: 'cheerio' | 'playwright' = 'cheerio'): ShopConfig {
  return { id, engine } as unknown as ShopConfig;
}

function makeProduct(id: string, typeId = 'type-1', setId = 'set-1'): WatchlistProductInternal {
  return { id, productTypeId: typeId, productSetId: setId } as WatchlistProductInternal;
}

function makeSetGroup(
  setId: string,
  searchPhrase: string,
  products: WatchlistProductInternal[] = [],
): SetGroup {
  return { setId, searchPhrase, products };
}

function makeCandidate(title: string, url = 'https://shop.com/product'): ProductCandidate {
  return { title, url, score: 90 };
}

function makeCandidateWithData(
  title: string,
  price: number | null,
  isAvailable: boolean,
): ProductCandidate {
  return {
    title,
    url: 'https://shop.com/product',
    score: 90,
    searchPageData: { price, isAvailable },
  };
}

function makeResult(productId: string): ProductResult {
  return {
    productId,
    shopId: 'shop-1',
    productUrl: 'https://shop.com/product',
    productTitle: productId,
    price: 100,
    isAvailable: true,
    timestamp: new Date(),
  } as unknown as ProductResult;
}

/**
 * Builds a minimal mock IScraper.
 * navigator.extractSearchCandidates returns the provided candidates list.
 */
function makeScraper(
  candidates: ProductCandidate[] = [],
  productResult: ProductResult | null = null,
) {
  const extractSearchCandidates = jest.fn().mockResolvedValue(candidates);
  const navigator = { extractSearchCandidates } as unknown as jest.Mocked<{
    extractSearchCandidates: typeof extractSearchCandidates;
  }>;

  const scraper: MockScraper = {
    getNavigator: jest.fn().mockReturnValue(navigator),
    scrapeProductWithUrl: jest.fn().mockResolvedValue(productResult),
    createResultFromSearchData: jest.fn().mockReturnValue(makeResult('p1')),
    close: jest.fn().mockResolvedValue(undefined),
  } as unknown as MockScraper;

  return { scraper, navigator, extractSearchCandidates };
}

/**
 * Builds a mock IScraperFactory that always returns the same scraper instance.
 */
function makeFactory(scraper: MockScraper): jest.Mocked<IScraperFactory> {
  return {
    create: jest.fn().mockReturnValue(scraper),
    groupByEngine: jest.fn((shops: ShopConfig[]) => ({
      cheerio: shops.filter((s) => s.engine !== 'playwright'),
      playwright: shops.filter((s) => s.engine === 'playwright'),
    })),
  } as jest.Mocked<IScraperFactory>;
}

function makeLogger() {
  return { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

function makeDispatcher(): jest.Mocked<IMultiUserDispatcher> {
  return { processResult: jest.fn() } as jest.Mocked<IMultiUserDispatcher>;
}

/**
 * Builds a minimal mock pipeline that returns a match result for the given key.
 */
function makePipeline(
  typeId = 'type-1',
  setId = 'set-1',
): { pipeline: ProductMatchingPipeline; matchResult: MatchResult } {
  const matchResult: MatchResult = {
    productType: {
      id: typeId,
      name: 'Booster Box',
      matchingProfile: { required: [], forbidden: [] },
      contains: [],
    } as MatchableProductType,
    productSet: {
      id: setId,
      name: 'Surging Sparks',
      series: 'Scarlet & Violet',
      setNumber: '8',
      setAbbreviation: 'sv08',
    } as MatchableProductSet,
    score: 90,
    normalizedTitle: 'surging sparks booster box',
  } as unknown as MatchResult;

  const pipeline = {
    match: jest.fn().mockReturnValue(matchResult),
  } as unknown as ProductMatchingPipeline;
  return { pipeline, matchResult };
}

/**
 * Builds a fully configured ScanCycleRunner with pipeline + watchlist index set.
 */
function makeRunner(opts: {
  scraper?: MockScraper;
  factory?: jest.Mocked<IScraperFactory>;
  dispatcher?: jest.Mocked<IMultiUserDispatcher>;
  logger?: ReturnType<typeof makeLogger>;
  resultBuffer?: ResultBuffer;
  onShopComplete?: () => Promise<void>;
  pipeline?: ProductMatchingPipeline;
  watchlistIndex?: Map<string, WatchlistProductInternal[]>;
}) {
  const {
    scraper: sc,
    factory: ft,
    dispatcher: dp,
    logger: lg,
    resultBuffer: rb,
    onShopComplete,
    pipeline: pl,
    watchlistIndex: wi,
  } = opts;

  const defaultScraper = sc ?? makeScraper().scraper;
  const factory = ft ?? makeFactory(defaultScraper);
  const dispatcher = dp ?? makeDispatcher();
  const logger = lg ?? makeLogger();
  const resultBuffer = rb ?? new ResultBuffer();
  const { pipeline, matchResult } = makePipeline();

  const config: ScanCycleConfig = {
    scraperFactory: factory,
    resultBuffer,
    dispatcher,
    logger,
    onShopComplete,
  };

  const runner = new ScanCycleRunner(config);

  const usePipeline = pl ?? pipeline;
  const useIndex = wi ?? new Map([['type-1|set-1', [makeProduct('p1')]]]);
  runner.setPipelineConfig(usePipeline, useIndex);

  return { runner, factory, dispatcher, logger, resultBuffer, pipeline: usePipeline, matchResult };
}

// ─── setPipelineConfig ────────────────────────────────────────────────────────

describe('setPipelineConfig()', () => {
  it('throws when runPlaywrightScanCycle is called before setPipelineConfig', async () => {
    const { scraper } = makeScraper([makeCandidate('Surging Sparks Booster Box')]);
    const factory = makeFactory(scraper);
    const logger = makeLogger();
    const runner = new ScanCycleRunner({
      scraperFactory: factory,
      resultBuffer: new ResultBuffer(),
      dispatcher: makeDispatcher(),
      logger,
    });
    // No setPipelineConfig call

    const shop = makeShop('shop-pw', 'playwright');
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [shop] });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwright = require('playwright');
    playwright.chromium.launch.mockResolvedValue(mockBrowserObj);

    await expect(
      runner.runPlaywrightScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []),
    ).rejects.toThrow('Pipeline not initialized');
  });
});

// ─── runCheerioScanCycle ──────────────────────────────────────────────────────

describe('runCheerioScanCycle()', () => {
  it('returns early when there are no Cheerio shops', async () => {
    const { runner, factory, logger } = makeRunner({});
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [] });

    await runner.runCheerioScanCycle([], [], []);

    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Cheerio'),
      expect.anything(),
    );
  });

  it('dispatches a result when a candidate matches the watchlist', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper(
      [makeCandidate('Surging Sparks Booster Box')],
      makeResult('p1'),
    );
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    // Phase 2: scraper visits the product page and returns a result
    expect(scraper.scrapeProductWithUrl).toHaveBeenCalled();
    expect(dispatcher.processResult).toHaveBeenCalled();
  });

  it('uses search-page data directly when price is present, skipping product page visit', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper([
      makeCandidateWithData('Surging Sparks Booster Box', 299, true),
    ]);
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    expect(scraper.scrapeProductWithUrl).not.toHaveBeenCalled();
    expect(scraper.createResultFromSearchData).toHaveBeenCalled();
    expect(dispatcher.processResult).toHaveBeenCalled();
  });

  it('skips product page visit when item is unavailable even without price', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper([
      makeCandidateWithData('Surging Sparks Booster Box', null, false),
    ]);
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    expect(scraper.scrapeProductWithUrl).not.toHaveBeenCalled();
    expect(scraper.createResultFromSearchData).toHaveBeenCalled();
    expect(dispatcher.processResult).toHaveBeenCalled();
  });

  it('does not dispatch when candidate has null price and product page returns null', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper(
      [makeCandidate('Surging Sparks Booster Box')],
      null, // product page returns null
    );
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    expect(dispatcher.processResult).not.toHaveBeenCalled();
  });

  it('skips candidates not matched by pipeline', async () => {
    const { scraper } = makeScraper([makeCandidate('Unknown Product')]);
    const dispatcher = makeDispatcher();
    const { pipeline } = makePipeline();
    (pipeline.match as jest.Mock).mockReturnValue(null); // no match

    const { runner, factory } = makeRunner({ scraper, dispatcher, pipeline });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    expect(dispatcher.processResult).not.toHaveBeenCalled();
  });

  it('calls onShopComplete after each shop', async () => {
    const { scraper } = makeScraper([]);
    const onShopComplete = jest.fn().mockResolvedValue(undefined);
    const { runner, factory } = makeRunner({ scraper, onShopComplete });

    const shops = [makeShop('shop-a'), makeShop('shop-b')];
    factory.groupByEngine.mockReturnValue({ cheerio: shops, playwright: [] });

    await runner.runCheerioScanCycle(shops, [], []);

    expect(onShopComplete).toHaveBeenCalledTimes(2);
  });

  it('trips the circuit breaker after 3 consecutive search failures and skips Phase 2', async () => {
    const { scraper, extractSearchCandidates } = makeScraper();
    extractSearchCandidates.mockRejectedValue(new Error('timeout'));
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({ scraper, dispatcher });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    const setGroups = [
      makeSetGroup('set-1', 'Phrase 1'),
      makeSetGroup('set-2', 'Phrase 2'),
      makeSetGroup('set-3', 'Phrase 3'),
    ];
    await runner.runCheerioScanCycle([shop], setGroups, []);

    // Breaker trips at 3 failures — Phase 2 is skipped entirely
    expect(dispatcher.processResult).not.toHaveBeenCalled();
    expect(scraper.scrapeProductWithUrl).not.toHaveBeenCalled();
  });

  it('logs an error (not rethrows) when a product page scrape throws', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper([makeCandidate('Surging Sparks Booster Box')]);
    scraper.scrapeProductWithUrl.mockRejectedValue(new Error('network error'));
    const logger = makeLogger();
    const { runner, factory } = makeRunner({
      scraper,
      logger,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    await expect(
      runner.runCheerioScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Error scanning product',
      expect.objectContaining({ error: 'network error' }),
    );
  });

  it('deduplicates the same candidate across multiple set searches', async () => {
    const product = makeProduct('p1');
    const { scraper, extractSearchCandidates } = makeScraper(
      [makeCandidate('Surging Sparks Booster Box')],
      makeResult('p1'),
    );
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-a');
    factory.groupByEngine.mockReturnValue({ cheerio: [shop], playwright: [] });

    // Two set searches both return the same candidate title
    extractSearchCandidates.mockResolvedValue([makeCandidate('Surging Sparks Booster Box')]);

    await runner.runCheerioScanCycle(
      [shop],
      [makeSetGroup('set-1', 'Phrase 1'), makeSetGroup('set-1', 'Phrase 2')],
      [],
    );

    // Product is dispatched only once despite two matching searches
    expect(dispatcher.processResult).toHaveBeenCalledTimes(1);
  });
});

// ─── runPlaywrightScanCycle ───────────────────────────────────────────────────

describe('runPlaywrightScanCycle()', () => {
  let chromiumLaunch: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwright = require('playwright');
    chromiumLaunch = playwright.chromium.launch;
    chromiumLaunch.mockResolvedValue(mockBrowserObj);
    mockBrowserClose.mockClear();
  });

  it('returns early when there are no Playwright shops', async () => {
    const { runner, factory, logger } = makeRunner({});
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [] });

    await runner.runPlaywrightScanCycle([], [], []);

    expect(chromiumLaunch).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('Playwright'),
      expect.anything(),
    );
  });

  it('launches and closes a browser for Playwright shops', async () => {
    const { scraper } = makeScraper([]);
    const { runner, factory } = makeRunner({ scraper });

    const shop = makeShop('shop-pw', 'playwright');
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [shop] });

    await runner.runPlaywrightScanCycle([shop], [], []);

    expect(chromiumLaunch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it('dispatches a result for a Playwright shop using search-page data', async () => {
    const product = makeProduct('p1');
    const { scraper } = makeScraper([
      makeCandidateWithData('Surging Sparks Booster Box', 299, true),
    ]);
    const dispatcher = makeDispatcher();
    const { runner, factory } = makeRunner({
      scraper,
      dispatcher,
      watchlistIndex: new Map([['type-1|set-1', [product]]]),
    });

    const shop = makeShop('shop-pw', 'playwright');
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [shop] });

    await runner.runPlaywrightScanCycle([shop], [makeSetGroup('set-1', 'Surging Sparks')], []);

    expect(scraper.createResultFromSearchData).toHaveBeenCalled();
    expect(dispatcher.processResult).toHaveBeenCalled();
  });

  it('closes browser even if an error is thrown during scanning', async () => {
    const { scraper, extractSearchCandidates } = makeScraper([]);
    extractSearchCandidates.mockRejectedValue(new Error('boom'));
    const { runner, factory } = makeRunner({ scraper });

    const shop = makeShop('shop-pw', 'playwright');
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: [shop] });

    // Should not propagate the search error (circuit breaker handles it)
    await runner.runPlaywrightScanCycle([shop], [makeSetGroup('set-1', 'phrase')], []);

    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it('calls onShopComplete after each Playwright shop', async () => {
    const { scraper } = makeScraper([]);
    const onShopComplete = jest.fn().mockResolvedValue(undefined);
    const { runner, factory } = makeRunner({ scraper, onShopComplete });

    const shops = [makeShop('shop-pw1', 'playwright'), makeShop('shop-pw2', 'playwright')];
    factory.groupByEngine.mockReturnValue({ cheerio: [], playwright: shops });

    await runner.runPlaywrightScanCycle(shops, [], []);

    expect(onShopComplete).toHaveBeenCalledTimes(2);
  });
});
