import { chromium, Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal } from '../types';
import { ScraperFactory } from '../scrapers/ScraperFactory';
import { NotificationService } from './NotificationService';
import { StateManager } from './StateManager';
import { Logger } from './Logger';
import { SummaryService } from './SummaryService';
import { IShopRepository, IWatchlistRepository, INotificationStateRepository, IProductResultRepository } from '../repositories';

/**
 * Main orchestrator that runs the price monitoring loop.
 */
export class PriceMonitor {
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private stateManager: StateManager;
  private notificationService: NotificationService;
  private logger: Logger;
  private intervalMs: number;
  private playwrightIntervalMs: number;
  private intervalId?: NodeJS.Timeout;
  private playwrightIntervalId?: NodeJS.Timeout;
  private summaryService?: SummaryService;
  private isCheerioScanning: boolean = false;
  private isPlaywrightScanning: boolean = false;
  private shopRepository: IShopRepository;
  private watchlistRepository: IWatchlistRepository;
  private productResultRepository?: IProductResultRepository;

  constructor(
    telegramToken: string,
    telegramChatId: string,
    shopRepository: IShopRepository,
    watchlistRepository: IWatchlistRepository,
    intervalMs: number = 60000,
    logLevel: 'info' | 'debug' = 'info',
    playwrightIntervalMs?: number,
    notificationStateRepository?: INotificationStateRepository,
    productResultRepository?: IProductResultRepository
  ) {
    this.logger = new Logger(logLevel);
    this.stateManager = new StateManager(this.logger, notificationStateRepository);
    this.notificationService = new NotificationService(
      telegramToken,
      telegramChatId,
      this.logger
    );
    this.shopRepository = shopRepository;
    this.watchlistRepository = watchlistRepository;
    this.productResultRepository = productResultRepository;
    this.intervalMs = intervalMs;
    this.playwrightIntervalMs = playwrightIntervalMs || intervalMs;
  }

  /**
   * Sets the summary service to receive scan results.
   */
  setSummaryService(summaryService: SummaryService): void {
    this.summaryService = summaryService;
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
      products: this.products.length,
      intervalMs: this.intervalMs
    });
  }

  /**
   * Runs Cheerio scan cycle (lightweight HTTP-based scraping).
   */
  async runCheerioScanCycle(): Promise<void> {
    if (this.isCheerioScanning) {
      this.logger.warn('Cheerio scan cycle already in progress, skipping');
      return;
    }

    this.isCheerioScanning = true;

    try {
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
    } finally {
      this.isCheerioScanning = false;
    }
  }

  /**
   * Runs Playwright scan cycle (browser-based scraping - resource intensive).
   */
  async runPlaywrightScanCycle(): Promise<void> {
    if (this.isPlaywrightScanning) {
      this.logger.warn('Playwright scan cycle already in progress, skipping');
      return;
    }

    this.isPlaywrightScanning = true;

    try {
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
    } finally {
      this.isPlaywrightScanning = false;
    }
  }

  /**
   * Runs a full scan cycle (both Cheerio and Playwright).
   * Used for initial scan on startup.
   */
  async runFullScanCycle(): Promise<void> {
    this.logger.info('Starting full scan cycle', {
      shops: this.shops.length,
      products: this.products.length
    });

    await this.runCheerioScanCycle();
    await this.runPlaywrightScanCycle();

    this.logger.info('Full scan cycle completed');
  }

  /**
   * Scans a single product on a single shop.
   */
  private async scanProduct(
    shop: ShopConfig,
    product: WatchlistProductInternal,
    browser?: Browser
  ): Promise<void> {
    // Create scraper with engine
    const scraper = ScraperFactory.create(shop, this.logger, browser);

    try {
      // Scrape the product
      const result = await scraper.scrapeProduct(product);

      this.logger.info('Product scanned', {
        product: product.id,
        shop: shop.id,
        price: result.price,
        available: result.isAvailable,
        url: result.productUrl
      });

      // Save result to repository (if configured)
      if (this.productResultRepository) {
        try {
          await this.productResultRepository.save(result);
        } catch (error) {
          this.logger.error('Failed to save product result', {
            product: product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Record result for summary service
      if (this.summaryService) {
        this.summaryService.recordResult(product, result, shop);
      }

      // Check if we should notify
      const meetsMaxPrice = result.price !== null && result.price <= product.price.max;
      const meetsAllCriteria = result.isAvailable && meetsMaxPrice;

      if (meetsAllCriteria) {
        const shouldNotify = await this.stateManager.shouldNotify(
          product.id,
          shop.id,
          result
        );

        if (shouldNotify) {
          this.logger.info('Sending notification', {
            product: product.id,
            shop: shop.id,
            price: result.price
          });

          try {
            await this.notificationService.sendAlert(product, result, shop);
            await this.stateManager.markNotified(product.id, shop.id, result);
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

  /**
   * Starts the monitoring loop with separate intervals for Cheerio and Playwright.
   */
  start(): void {
    this.logger.info('Starting Price Monitor', {
      cheerioIntervalMs: this.intervalMs,
      playwrightIntervalMs: this.playwrightIntervalMs
    });

    // Run full scan immediately on start
    this.runFullScanCycle().catch((error: Error) => {
      this.logger.error('Error in initial scan cycle', {
        error: error.message
      });
    });

    // Cheerio shops interval (lightweight, can run frequently)
    this.intervalId = setInterval(() => {
      this.runCheerioScanCycle().catch((error: Error) => {
        this.logger.error('Error in Cheerio scan cycle', {
          error: error.message
        });
      });
    }, this.intervalMs);

    // Playwright shops interval (resource intensive, runs less frequently)
    this.playwrightIntervalId = setInterval(() => {
      this.runPlaywrightScanCycle().catch((error: Error) => {
        this.logger.error('Error in Playwright scan cycle', {
          error: error.message
        });
      });
    }, this.playwrightIntervalMs);

    this.logger.info('Price Monitor started successfully');
  }

  /**
   * Stops the monitoring loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.playwrightIntervalId) {
      clearInterval(this.playwrightIntervalId);
      this.playwrightIntervalId = undefined;
    }
    this.logger.info('Price Monitor stopped');
  }
}
