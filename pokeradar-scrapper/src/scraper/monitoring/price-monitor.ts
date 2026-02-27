/**
 * Price monitor that orchestrates product scanning across shops.
 * Designed for single-run cron execution with multi-user notification support.
 */

import { ShopConfig, WatchlistProductInternal } from '../../shared/types';
import { MultiUserNotificationDispatcher } from '../../shared/notification';
import { NotificationStateService } from '../../shared/notification';
import { ResultBuffer, IProductResultRepository } from './result-buffer';
import { ScanCycleRunner, IScraperFactory, IScanLogger } from './scan-cycle-runner';
import { groupProductsBySet, SetGroup } from '../../shared/utils/product-utils';
import { ProductSetModel, ProductTypeModel } from '../../infrastructure/database/models';
import { ProductMatchingPipeline, MatchableProductType, MatchableProductSet } from '../../matching';

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
  dispatcher: MultiUserNotificationDispatcher;
  stateManager: NotificationStateService;
  shopRepository: IShopRepository;
  watchlistRepository: IWatchlistRepository;
  productResultRepository?: IProductResultRepository;
  logger: IScanLogger;
}

/**
 * Price monitor that scans products across shops.
 * Optimized for reduced MongoDB egress with batch operations.
 *
 * DB queries per cycle: 4 total (3 preloads + 1 state flush),
 * regardless of user count.
 */
export class PriceMonitor {
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private setGroups: SetGroup[] = [];
  private ungroupedProducts: WatchlistProductInternal[] = [];
  private resultBuffer: ResultBuffer;
  private cycleRunner: ScanCycleRunner;

  constructor(private config: PriceMonitorConfig) {
    this.resultBuffer = new ResultBuffer(config.productResultRepository, config.logger);

    this.cycleRunner = new ScanCycleRunner({
      scraperFactory: config.scraperFactory,
      resultBuffer: this.resultBuffer,
      dispatcher: config.dispatcher,
      logger: config.logger,
    });
  }

  /**
   * Initializes the monitor by loading shops, watchlist, and preloading user data.
   */
  async initialize(): Promise<void> {
    this.config.logger.info('Initializing Price Monitor...');

    // Load shop configurations
    this.shops = await this.config.shopRepository.getEnabled();
    if (this.shops.length === 0) {
      throw new Error('No shop configurations found');
    }

    // Load product catalog (excluding disabled products)
    const allProducts = await this.config.watchlistRepository.getAll();
    if (allProducts.length === 0) {
      throw new Error('No products in watchlist');
    }

    // Preload user watch entries and notification targets (2 DB queries)
    const allProductIds = allProducts.map((p) => p.id);
    await this.config.dispatcher.preloadForCycle(allProductIds);

    // Load notification states for subscribed products only (1 DB query)
    await this.config.stateManager.loadFromRepository(allProductIds);

    // Load product types and sets from DB
    const [productTypeDocs, productSetDocs] = await Promise.all([
      ProductTypeModel.find().select('id name matchingProfile').lean(),
      ProductSetModel.find().select('id name series setNumber setAbbreviation').lean(),
    ]);

    const productTypes: MatchableProductType[] = productTypeDocs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      matchingProfile: {
        required: doc.matchingProfile?.required ?? [],
        forbidden: doc.matchingProfile?.forbidden ?? [],
      },
    }));

    const productSets: MatchableProductSet[] = productSetDocs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      series: doc.series,
      setNumber: doc.setNumber,
      setAbbreviation: doc.setAbbreviation,
    }));

    // Build pipeline (precomputed once, reused for every title match)
    const pipeline = new ProductMatchingPipeline({ productTypes, productSets });

    // Build watchlist index: typeId|setId → products[]
    const watchlistIndex = new Map<string, WatchlistProductInternal[]>();
    for (const product of allProducts) {
      const key = `${product.productTypeId}|${product.productSetId}`;
      const existing = watchlistIndex.get(key) ?? [];
      existing.push(product);
      watchlistIndex.set(key, existing);
    }

    // Build setMap for SetGroup construction (search phrase = set name)
    const setMap = new Map<string, { name: string; series: string }>();
    for (const doc of productSetDocs) {
      setMap.set(doc.id, { name: doc.name, series: doc.series });
    }

    this.products = allProducts;

    // Group products by set for search URL construction
    const { setGroups, ungrouped } = groupProductsBySet(allProducts, setMap);
    this.setGroups = setGroups;
    this.ungroupedProducts = ungrouped;

    // Pass pipeline + watchlistIndex to runner
    this.cycleRunner.setPipelineConfig(pipeline, watchlistIndex);

    this.config.logger.info('Price Monitor initialized', {
      shops: this.shops.length,
      products: allProducts.length,
      productTypes: productTypes.length,
      productSets: productSets.length,
      setGroups: setGroups.length,
      productsInSets: allProducts.length - ungrouped.length,
      ungrouped: ungrouped.length,
    });
  }

  /**
   * Runs a full scan cycle (both Cheerio and Playwright).
   * Buffers all results and performs a single batch upsert at the end.
   */
  async runFullScanCycle(): Promise<void> {
    if (this.products.length === 0) {
      this.config.logger.info('No products to scan, skipping cycle');
      return;
    }

    this.config.logger.info('Starting full scan cycle', {
      shops: this.shops.length,
      products: this.products.length,
    });

    // Reset buffer at start of cycle
    this.resultBuffer.clear();

    // Run Cheerio cycle
    await this.cycleRunner.runCheerioScanCycle(this.shops, this.setGroups, this.ungroupedProducts);

    // Hint GC to clean up before memory-intensive Playwright phase
    if (global.gc) {
      global.gc();
    }

    // Run Playwright cycle
    await this.cycleRunner.runPlaywrightScanCycle(
      this.shops,
      this.setGroups,
      this.ungroupedProducts,
    );

    // Flush all buffered data to MongoDB
    await this.flushAllChanges();

    this.config.logger.info('Full scan cycle completed');
  }

  /**
   * Runs only Cheerio scan cycle.
   */
  async runCheerioScanCycle(): Promise<void> {
    await this.cycleRunner.runCheerioScanCycle(this.shops, this.setGroups, this.ungroupedProducts);
  }

  /**
   * Runs only Playwright scan cycle.
   */
  async runPlaywrightScanCycle(): Promise<void> {
    await this.cycleRunner.runPlaywrightScanCycle(
      this.shops,
      this.setGroups,
      this.ungroupedProducts,
    );
  }

  /**
   * Flushes all buffered changes to MongoDB.
   */
  private async flushAllChanges(): Promise<void> {
    const resultsCount = this.resultBuffer.size();

    // Flush ProductResults
    await this.resultBuffer.flush();

    // Send queued notifications (rate-limited)
    await this.config.dispatcher.flushNotifications();

    // Flush NotificationState changes (1 bulkWrite)
    await this.config.stateManager.flushChanges();

    this.config.logger.info('Flushed all changes to database', {
      productResults: resultsCount,
    });
  }
}
