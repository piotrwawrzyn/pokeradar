/**
 * PriceMonitor unit tests.
 *
 * PriceMonitor orchestrates the full scan cycle:
 *   initialize() → load shops, products, build pipeline + watchlist index
 *   runFullScanCycle() → run Cheerio + Playwright cycles, flush all changes
 *
 * Mocks: all repositories, Mongoose models, ScanCycleRunner (via jest.mock),
 *        MultiUserNotificationDispatcher, NotificationStateService.
 */

import { ShopConfig } from '@pokeradar/shared';
import { WatchlistProductInternal } from '../../../shared/types';
import { MultiUserNotificationDispatcher } from '../../../shared/notification/multi-user-dispatcher';
import { NotificationStateService } from '../../../shared/notification/notification-state.service';
import {
  PriceMonitor,
  PriceMonitorConfig,
  IShopRepository,
  IWatchlistRepository,
} from '../price-monitor';
import { IProductResultRepository } from '../result-buffer';
import { IScraperFactory } from '../scan-cycle-runner';

// ─── Mock ProductMatchingPipeline ─────────────────────────────────────────────

const mockPipelineMatch = jest.fn().mockReturnValue(null);

jest.mock('../../../matching', () => ({
  ProductMatchingPipeline: jest.fn().mockImplementation(() => ({
    match: mockPipelineMatch,
  })),
}));

// ─── Mock Mongoose models ─────────────────────────────────────────────────────

const mockProductTypeLean = jest.fn();
const mockProductTypeSelect = jest.fn().mockReturnValue({ lean: mockProductTypeLean });
const mockProductTypeFind = jest.fn().mockReturnValue({ select: mockProductTypeSelect });

const mockProductSetLean = jest.fn();
const mockProductSetSelect = jest.fn().mockReturnValue({ lean: mockProductSetLean });
const mockProductSetFind = jest.fn().mockReturnValue({ select: mockProductSetSelect });

jest.mock('@pokeradar/shared', () => {
  const actual = jest.requireActual('@pokeradar/shared');
  return {
    ...actual,
    ProductTypeModel: {
      find: (...args: unknown[]) => mockProductTypeFind(...args),
    },
    ProductSetModel: {
      find: (...args: unknown[]) => mockProductSetFind(...args),
    },
  };
});

// ─── Mock ScanCycleRunner ─────────────────────────────────────────────────────

const mockSetPipelineConfig = jest.fn();
const mockRunCheerioScanCycle = jest.fn().mockResolvedValue(undefined);
const mockRunPlaywrightScanCycle = jest.fn().mockResolvedValue(undefined);

jest.mock('../scan-cycle-runner', () => ({
  ScanCycleRunner: jest.fn().mockImplementation(() => ({
    setPipelineConfig: mockSetPipelineConfig,
    runCheerioScanCycle: mockRunCheerioScanCycle,
    runPlaywrightScanCycle: mockRunPlaywrightScanCycle,
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeShop(id: string): ShopConfig {
  return { id } as unknown as ShopConfig;
}

function makeProduct(id: string, typeId = 'type-1', setId = 'set-1'): WatchlistProductInternal {
  return { id, productTypeId: typeId, productSetId: setId } as WatchlistProductInternal;
}

function makeProductTypeDoc(id: string) {
  return {
    id,
    name: 'Booster Box',
    matchingProfile: { required: ['booster'], forbidden: [] },
    contains: [],
  };
}

function makeProductSetDoc(id: string, name: string) {
  return { id, name, series: 'Scarlet & Violet', setNumber: 8, setAbbreviation: 'sv08' };
}

function makeLogger() {
  return { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

function makeConfig(overrides: Partial<PriceMonitorConfig> = {}): PriceMonitorConfig {
  const shopRepository: jest.Mocked<IShopRepository> = {
    getEnabled: jest.fn().mockResolvedValue([makeShop('shop-1')]),
  };

  const watchlistRepository: jest.Mocked<IWatchlistRepository> = {
    getAll: jest.fn().mockResolvedValue([makeProduct('p1')]),
  };

  const productResultRepository: jest.Mocked<IProductResultRepository> = {
    upsertHourlyBatch: jest.fn().mockResolvedValue(undefined),
  };

  const dispatcher = {
    preloadForCycle: jest.fn().mockResolvedValue(undefined),
    flushNotifications: jest.fn().mockResolvedValue(undefined),
    processResult: jest.fn(),
  } as unknown as jest.Mocked<MultiUserNotificationDispatcher>;

  const stateManager = {
    loadFromRepository: jest.fn().mockResolvedValue(undefined),
    flushChanges: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<NotificationStateService>;

  const scraperFactory = {
    create: jest.fn(),
    groupByEngine: jest.fn().mockReturnValue({ cheerio: [], playwright: [] }),
  } as jest.Mocked<IScraperFactory>;

  return {
    shopRepository,
    watchlistRepository,
    productResultRepository,
    dispatcher,
    stateManager,
    scraperFactory,
    logger: makeLogger(),
    ...overrides,
  };
}

function setupDefaultModels() {
  mockProductTypeLean.mockResolvedValue([makeProductTypeDoc('type-1')]);
  mockProductSetLean.mockResolvedValue([makeProductSetDoc('set-1', 'Surging Sparks')]);
}

// ─── initialize() ─────────────────────────────────────────────────────────────

describe('initialize()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultModels();
  });

  it('throws when no shop configurations are found', async () => {
    const config = makeConfig();
    (config.shopRepository.getEnabled as jest.Mock).mockResolvedValue([]);
    const monitor = new PriceMonitor(config);

    await expect(monitor.initialize()).rejects.toThrow('No shop configurations found');
  });

  it('throws when watchlist is empty', async () => {
    const config = makeConfig();
    (config.watchlistRepository.getAll as jest.Mock).mockResolvedValue([]);
    const monitor = new PriceMonitor(config);

    await expect(monitor.initialize()).rejects.toThrow('No products in watchlist');
  });

  it('preloads user data and notification state for all product IDs', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);

    await monitor.initialize();

    expect(config.dispatcher.preloadForCycle).toHaveBeenCalledWith(['p1']);
    expect(config.stateManager.loadFromRepository).toHaveBeenCalledWith(['p1']);
  });

  it('calls setPipelineConfig on the runner with pipeline and watchlist index', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);

    await monitor.initialize();

    expect(mockSetPipelineConfig).toHaveBeenCalledWith(
      expect.objectContaining({ match: expect.any(Function) }),
      expect.any(Map),
    );
  });

  it('builds watchlist index with typeId|setId composite key', async () => {
    const config = makeConfig();
    (config.watchlistRepository.getAll as jest.Mock).mockResolvedValue([
      makeProduct('p1', 'type-1', 'set-1'),
      makeProduct('p2', 'type-1', 'set-1'),
      makeProduct('p3', 'type-2', 'set-1'),
    ]);
    const monitor = new PriceMonitor(config);

    await monitor.initialize();

    const [, watchlistIndex] = mockSetPipelineConfig.mock.calls[0];
    expect(watchlistIndex.get('type-1|set-1')).toHaveLength(2);
    expect(watchlistIndex.get('type-2|set-1')).toHaveLength(1);
  });
});

// ─── runFullScanCycle() ───────────────────────────────────────────────────────

describe('runFullScanCycle()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultModels();
    mockRunCheerioScanCycle.mockResolvedValue(undefined);
    mockRunPlaywrightScanCycle.mockResolvedValue(undefined);
  });

  it('skips the cycle when there are no products (no initialize call)', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    // Note: products is empty by default before initialize()

    await monitor.runFullScanCycle();

    expect(mockRunCheerioScanCycle).not.toHaveBeenCalled();
  });

  it('runs Cheerio and Playwright cycles after initialize', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    await monitor.runFullScanCycle();

    expect(mockRunCheerioScanCycle).toHaveBeenCalled();
    expect(mockRunPlaywrightScanCycle).toHaveBeenCalled();
  });

  it('flushes notifications and state after each cycle via onShopComplete', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    // Capture the ScanCycleRunner config (includes onShopComplete)
    const { ScanCycleRunner } = jest.requireMock('../scan-cycle-runner');
    const runnerConfig = ScanCycleRunner.mock.calls[0][0];

    await runnerConfig.onShopComplete();

    expect(config.dispatcher.flushNotifications).toHaveBeenCalled();
    expect(config.stateManager.flushChanges).toHaveBeenCalled();
  });

  it('calls ResultBuffer.flush() at end of full cycle', async () => {
    const { ResultBuffer } = jest.requireActual('../result-buffer');
    const flushSpy = jest.spyOn(ResultBuffer.prototype, 'flush').mockResolvedValue(undefined);

    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    await monitor.runFullScanCycle();

    expect(flushSpy).toHaveBeenCalled();
    flushSpy.mockRestore();
  });

  it('does a final notification flush at end of full cycle', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    // Reset call count after init (preload may call these during onShopComplete)
    (config.dispatcher.flushNotifications as jest.Mock).mockClear();

    await monitor.runFullScanCycle();

    expect(config.dispatcher.flushNotifications).toHaveBeenCalled();
  });
});

// ─── runCheerioScanCycle() / runPlaywrightScanCycle() ─────────────────────────

describe('individual cycle methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultModels();
    mockRunCheerioScanCycle.mockResolvedValue(undefined);
    mockRunPlaywrightScanCycle.mockResolvedValue(undefined);
  });

  it('runCheerioScanCycle delegates to the runner', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    await monitor.runCheerioScanCycle();

    expect(mockRunCheerioScanCycle).toHaveBeenCalled();
    expect(mockRunPlaywrightScanCycle).not.toHaveBeenCalled();
  });

  it('runPlaywrightScanCycle delegates to the runner', async () => {
    const config = makeConfig();
    const monitor = new PriceMonitor(config);
    await monitor.initialize();

    await monitor.runPlaywrightScanCycle();

    expect(mockRunPlaywrightScanCycle).toHaveBeenCalled();
    expect(mockRunCheerioScanCycle).not.toHaveBeenCalled();
  });
});
