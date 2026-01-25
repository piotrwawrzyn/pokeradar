import { chromium, Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal } from '../types';
import { ScraperFactory } from '../scrapers/ScraperFactory';
import { NotificationService } from './NotificationService';
import { StateManager } from './StateManager';
import { Logger } from './Logger';
import { IShopRepository, IWatchlistRepository, INotificationStateRepository, IProductResultRepository } from '../repositories';

/**
 * Price monitor that scans products across shops.
 * Designed for single-run cron execution.
 */
export class PriceMonitor {
  private shops: ShopConfig[] = [];
  private products: WatchlistProductInternal[] = [];
  private stateManager: StateManager;
  private notificationService: NotificationService;
  private logger: Logger;
  private shopRepository: IShopRepository;
  private watchlistRepository: IWatchlistRepository;
  private productResultRepository?: IProductResultRepository;

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
    this.stateManager = new StateManager(this.logger, notificationStateRepository);
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

      // Save result to repository
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
}
