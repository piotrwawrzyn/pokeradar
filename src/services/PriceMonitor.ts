import * as fs from 'fs';
import * as path from 'path';
import { ShopConfig, WatchlistProductInternal, Watchlist } from '../types';
import { ScraperFactory } from '../scrapers/ScraperFactory';
import { NotificationService } from './NotificationService';
import { StateManager } from './StateManager';
import { Logger } from './Logger';
import { toInternalProducts } from '../utils/productUtils';

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
  private intervalId?: NodeJS.Timeout;

  constructor(
    telegramToken: string,
    telegramChatId: string,
    intervalMs: number = 60000,
    logLevel: 'info' | 'debug' = 'info'
  ) {
    this.logger = new Logger(logLevel);
    this.stateManager = new StateManager(this.logger);
    this.notificationService = new NotificationService(
      telegramToken,
      telegramChatId,
      this.logger
    );
    this.intervalMs = intervalMs;
  }

  /**
   * Initializes the monitor by loading shops and watchlist.
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Price Monitor...');

    // Load shop configurations
    this.loadShops();

    // Load watchlist
    this.loadWatchlist();

    this.logger.info('Price Monitor initialized', {
      shops: this.shops.length,
      products: this.products.length,
      intervalMs: this.intervalMs
    });

    // Send test notification
    try {
      await this.notificationService.sendTestNotification();
    } catch (error) {
      this.logger.warn('Failed to send test notification - check Telegram credentials');
    }
  }

  /**
   * Loads shop configurations from the config directory.
   */
  private loadShops(): void {
    const shopsDir = path.join(__dirname, '../config/shops');

    if (!fs.existsSync(shopsDir)) {
      throw new Error(`Shops directory not found: ${shopsDir}`);
    }

    const files = fs.readdirSync(shopsDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(shopsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const shop: ShopConfig = JSON.parse(content);
      this.shops.push(shop);

      this.logger.info('Loaded shop configuration', {
        shop: shop.id,
        name: shop.name
      });
    }

    if (this.shops.length === 0) {
      throw new Error('No shop configurations found');
    }
  }

  /**
   * Loads the watchlist from the config directory.
   */
  private loadWatchlist(): void {
    const watchlistPath = path.join(__dirname, '../config/watchlist.json');

    if (!fs.existsSync(watchlistPath)) {
      throw new Error(`Watchlist not found: ${watchlistPath}`);
    }

    const content = fs.readFileSync(watchlistPath, 'utf-8');
    const watchlist: Watchlist = JSON.parse(content);
    this.products = toInternalProducts(watchlist.products);

    this.logger.info('Loaded watchlist', {
      products: this.products.length
    });

    if (this.products.length === 0) {
      throw new Error('No products in watchlist');
    }
  }

  /**
   * Runs a single scan cycle across all shops and products.
   */
  async runScanCycle(): Promise<void> {
    this.logger.info('Starting scan cycle', {
      shops: this.shops.length,
      products: this.products.length
    });

    const startTime = Date.now();

    for (const shop of this.shops) {
      for (const product of this.products) {
        try {
          await this.scanProduct(shop, product);
        } catch (error) {
          this.logger.error('Error scanning product', {
            product: product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    this.logger.info('Scan cycle completed', {
      durationMs: duration
    });
  }

  /**
   * Scans a single product on a single shop.
   */
  private async scanProduct(
    shop: ShopConfig,
    product: WatchlistProductInternal
  ): Promise<void> {
    this.logger.debug('Scanning product', {
      product: product.id,
      shop: shop.id
    });

    // Create scraper
    const scraper = ScraperFactory.create(shop, this.logger);

    // Scrape the product
    const result = await scraper.scrapeProduct(product);

    this.logger.info('Product scanned', {
      product: product.id,
      shop: shop.id,
      price: result.price,
      available: result.isAvailable,
      url: result.productUrl
    });

    // Check if we should notify
    const meetsMaxPrice = result.price !== null && result.price <= product.maxPrice;
    const meetsAllCriteria = result.isAvailable && meetsMaxPrice;

    if (meetsAllCriteria) {
      const shouldNotify = this.stateManager.shouldNotify(
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
          this.stateManager.markNotified(product.id, shop.id, result);
        } catch (error) {
          this.logger.error('Failed to send notification', {
            product: product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      this.logger.debug('Product does not meet criteria', {
        product: product.id,
        shop: shop.id,
        available: result.isAvailable,
        price: result.price,
        maxPrice: product.maxPrice
      });
    }
  }

  /**
   * Starts the monitoring loop.
   */
  start(): void {
    this.logger.info('Starting Price Monitor', {
      intervalMs: this.intervalMs
    });

    // Run immediately on start
    this.runScanCycle().catch(error => {
      this.logger.error('Error in initial scan cycle', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Then run every interval
    this.intervalId = setInterval(() => {
      this.runScanCycle().catch(error => {
        this.logger.error('Error in scan cycle', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.intervalMs);

    this.logger.info('Price Monitor started successfully');
  }

  /**
   * Stops the monitoring loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Price Monitor stopped');
    }
  }
}
