/**
 * Price monitor that orchestrates product scanning across shops.
 * Designed for single-run cron execution.
 */

import { ShopConfig, WatchlistProductInternal } from '../../shared/types';
import { ResultBuffer, IProductResultRepository } from './result-buffer';
import { ScanCycleRunner, IScraperFactory, INotificationStateManager, INotificationService, IScanLogger } from './scan-cycle-runner';

/**
 * Repository interfaces.
 */
export interface IShopRepository {
  getEnabled(): Promise<ShopConfig[]>;
}

export interface IWatchlistRepository {
  getAll(): Promise<WatchlistProductInternal[]>;
}

/**
 * Configuration for PriceMonitor.
 */
export interface PriceMonitorConfig {
  scraperFactory: IScraperFactory;
  notificationService: INotificationService;
  stateManager: INotificationStateManager & { loadFromRepository(): Promise<void>; flushChanges(): Promise<void> };
  shopRepository: IShopRepository;
  watchlistRepository: IWatchlistRepository;
  productResultRepository?: IProductResultRepository;
  logger: IScanLogger;
}

/**
 * Price monitor that scans products across shops.
 * Optimized for reduced MongoDB egress with batch operations.
 */
export class PriceMonitor {
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private resultBuffer: ResultBuffer;
  private cycleRunner: ScanCycleRunner;

  constructor(private config: PriceMonitorConfig) {
    this.resultBuffer = new ResultBuffer(
      config.productResultRepository,
      config.logger
    );

    this.cycleRunner = new ScanCycleRunner({
      scraperFactory: config.scraperFactory,
      resultBuffer: this.resultBuffer,
      stateManager: config.stateManager,
      notificationService: config.notificationService,
      logger: config.logger,
    });
  }

  /**
   * Initializes the monitor by loading shops and watchlist.
   */
  async initialize(): Promise<void> {
    this.config.logger.info('Initializing Price Monitor...');

    // Load shop configurations
    this.shops = await this.config.shopRepository.getEnabled();
    if (this.shops.length === 0) {
      throw new Error('No shop configurations found');
    }

    // Load watchlist
    this.products = await this.config.watchlistRepository.getAll();
    if (this.products.length === 0) {
      throw new Error('No products in watchlist');
    }

    // Load notification state from repository
    await this.config.stateManager.loadFromRepository();

    this.config.logger.info('Price Monitor initialized', {
      shops: this.shops.length,
      products: this.products.length,
    });
  }

  /**
   * Runs a full scan cycle (both Cheerio and Playwright).
   * Buffers all results and performs a single batch upsert at the end.
   */
  async runFullScanCycle(): Promise<void> {
    this.config.logger.info('Starting full scan cycle', {
      shops: this.shops.length,
      products: this.products.length,
    });

    // Reset buffer at start of cycle
    this.resultBuffer.clear();

    // Run Cheerio cycle
    await this.cycleRunner.runCheerioScanCycle(this.shops, this.products);

    // Hint GC to clean up before memory-intensive Playwright phase
    if (global.gc) {
      global.gc();
    }

    // Run Playwright cycle
    await this.cycleRunner.runPlaywrightScanCycle(this.shops, this.products);

    // Flush all buffered data to MongoDB
    await this.flushAllChanges();

    this.config.logger.info('Full scan cycle completed');
  }

  /**
   * Runs only Cheerio scan cycle.
   */
  async runCheerioScanCycle(): Promise<void> {
    await this.cycleRunner.runCheerioScanCycle(this.shops, this.products);
  }

  /**
   * Runs only Playwright scan cycle.
   */
  async runPlaywrightScanCycle(): Promise<void> {
    await this.cycleRunner.runPlaywrightScanCycle(this.shops, this.products);
  }

  /**
   * Flushes all buffered changes to MongoDB.
   */
  private async flushAllChanges(): Promise<void> {
    const resultsCount = this.resultBuffer.size();

    // Flush ProductResults
    await this.resultBuffer.flush();

    // Flush NotificationState changes
    await this.config.stateManager.flushChanges();

    this.config.logger.info('Flushed all changes to database', {
      productResults: resultsCount,
    });
  }
}
