import { chromium, Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../types';
import { ScraperFactory } from '../scrapers/ScraperFactory';
import { NotificationService } from './NotificationService';
import { NotificationStateManager } from './NotificationStateManager';
import { Logger } from './Logger';
import { IShopRepository, IWatchlistRepository, INotificationStateRepository, IProductResultRepository } from '../repositories';

/**
 * Price monitor that scans products across shops.
 * Designed for single-run cron execution.
 *
 * Optimized for reduced MongoDB egress:
 * - Buffers all results in memory during scan
 * - Single batch upsert at end of cycle (1 record per product/shop/hour)
 */
export class PriceMonitor {
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private stateManager: NotificationStateManager;
  private notificationService: NotificationService;
  private logger: Logger;
  private shopRepository: IShopRepository;
  private watchlistRepository: IWatchlistRepository;
  private productResultRepository?: IProductResultRepository;

  /** Buffer for scan results - flushed at end of scan cycle */
  private scanResultsBuffer: ProductResult[] = [];

  constructor(
    telegramToken: string,
    telegramChatId: string,
    shopRepository: IShopRepository,
    watchlistRepository: IWatchlistRepository,
    logLevel: 'info' | 'debug' = 'info',
    notificationStateRepository?: INotificationStateRepository,
    productResultRepository?: IProductResultRepository
  ) {
    this.logger = new Logger(logLevel);
    this.stateManager = new NotificationStateManager(this.logger, notificationStateRepository);
    this.notificationService = new NotificationService(
      telegramToken,
      telegramChatId,
      this.logger
    );
    this.shopRepository = shopRepository;
    this.watchlistRepository = watchlistRepository;
    this.productResultRepository = productResultRepository;
  }

  /**
   * Initializes the monitor by loading shops and watchlist.
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Price Monitor...');

    // Load shop configurations
    this.shops = await this.shopRepository.getEnabled();
    if (this.shops.length === 0) {
      throw new Error('No shop configurations found');
    }

    // Load watchlist
    this.products = await this.watchlistRepository.getAll();
    if (this.products.length === 0) {
      throw new Error('No products in watchlist');
    }

    // Load notification state from repository (if configured)
    await this.stateManager.loadFromRepository();

    this.logger.info('Price Monitor initialized', {
      shops: this.shops.length,
      products: this.products.length
    });
  }

  /**
   * Runs Cheerio scan cycle (lightweight HTTP-based scraping).
   */
  async runCheerioScanCycle(): Promise<void> {
    const { cheerio: cheerioShops } = ScraperFactory.groupByEngine(this.shops);

    if (cheerioShops.length === 0) {
      return;
    }

    this.logger.info('Starting Cheerio scan cycle', {
      shops: cheerioShops.length,
      products: this.products.length
    });

    const startTime = Date.now();

    for (const shop of cheerioShops) {
      for (const product of this.products) {
        try {
          await this.scanProduct(shop, product);
        } catch (error) {
          this.logger.error('Error scanning product', {
            product: product.id,
            shop: shop.id,
            engine: 'cheerio',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const duration = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    this.logger.info('Cheerio scan cycle completed', {
      durationMs: duration,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024)
    });
  }

  /**
   * Runs Playwright scan cycle (browser-based scraping - resource intensive).
   */
  async runPlaywrightScanCycle(): Promise<void> {
    const { playwright: playwrightShops } = ScraperFactory.groupByEngine(this.shops);

    if (playwrightShops.length === 0) {
      return;
    }

    this.logger.info('Starting Playwright scan cycle', {
      shops: playwrightShops.length,
      products: this.products.length
    });

    const startTime = Date.now();
    let browser: Browser | null = null;

    try {
      browser = await chromium.launch({ headless: true });

      for (const shop of playwrightShops) {
        for (const product of this.products) {
          try {
            await this.scanProduct(shop, product, browser);
          } catch (error) {
            this.logger.error('Error scanning product', {
              product: product.id,
              shop: shop.id,
              engine: 'playwright',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    const duration = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    this.logger.info('Playwright scan cycle completed', {
      durationMs: duration,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024)
    });
  }

  /**
   * Runs a full scan cycle (both Cheerio and Playwright).
   * Buffers all results and performs a single batch upsert at the end.
   */
  async runFullScanCycle(): Promise<void> {
    this.logger.info('Starting full scan cycle', {
      shops: this.shops.length,
      products: this.products.length
    });

    // Reset buffer at start of cycle
    this.scanResultsBuffer = [];

    await this.runCheerioScanCycle();
    await this.runPlaywrightScanCycle();

    // Flush all buffered data to MongoDB in batch operations
    await this.flushAllChanges();

    this.logger.info('Full scan cycle completed');
  }

  /**
   * Flushes all buffered changes to MongoDB.
   * Coordinates ProductResult and NotificationState batch writes.
   */
  private async flushAllChanges(): Promise<void> {
    const resultsCount = this.scanResultsBuffer.length;

    // Flush ProductResults
    if (this.productResultRepository && resultsCount > 0) {
      try {
        await this.productResultRepository.upsertHourlyBatch(this.scanResultsBuffer);
      } catch (error) {
        this.logger.error('Failed to flush scan results', {
          count: resultsCount,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Flush NotificationState changes
    await this.stateManager.flushChanges();

    this.logger.info('Flushed all changes to database', {
      productResults: resultsCount
    });

    this.scanResultsBuffer = [];
  }

  /**
   * Scans a single product on a single shop.
   */
  private async scanProduct(
    shop: ShopConfig,
    product: WatchlistProductInternal,
    browser?: Browser
  ): Promise<void> {
    const scraper = ScraperFactory.create(shop, this.logger, browser);

    try {
      const result = await scraper.scrapeProduct(product);

      this.logger.info('Product scanned', {
        product: product.id,
        shop: shop.id,
        price: result.price,
        available: result.isAvailable,
        url: result.productUrl
      });

      // Buffer result for batch write at end of scan cycle
      this.scanResultsBuffer.push(result);

      // Update tracked state on every scan - enables reset detection
      // when product becomes unavailable or price increases (buffered)
      this.stateManager.updateTrackedState(product.id, shop.id, result);

      // Check if we should notify
      const meetsMaxPrice = result.price !== null && result.price <= product.price.max;
      const meetsAllCriteria = result.isAvailable && meetsMaxPrice;

      if (meetsAllCriteria) {
        const shouldNotify = this.stateManager.shouldNotify(product.id, shop.id);

        if (shouldNotify) {
          this.logger.info('Sending notification', {
            product: product.id,
            shop: shop.id,
            price: result.price
          });

          try {
            await this.notificationService.sendAlert(product, result, shop);
            this.stateManager.markNotified(product.id, shop.id, result);
          } catch (error) {
            this.logger.error('Failed to send notification', {
              product: product.id,
              shop: shop.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } finally {
      await scraper.close();
    }
  }
}
