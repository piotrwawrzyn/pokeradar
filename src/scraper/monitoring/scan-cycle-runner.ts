/**
 * Scan cycle runner for executing scraping operations.
 */

import { Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../../shared/types';
import { ResultBuffer } from './result-buffer';

const CHEERIO_CONCURRENCY = 10;
const PRODUCT_CONCURRENCY = 3;

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()!;
      await task();
    }
  });
  await Promise.allSettled(workers);
}

/**
 * Logger interface for scan operations.
 */
export interface IScanLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Scraper factory interface.
 */
export interface IScraperFactory {
  create(shop: ShopConfig, logger?: IScanLogger, browser?: Browser): IScraper;
  groupByEngine(shops: ShopConfig[]): { cheerio: ShopConfig[]; playwright: ShopConfig[] };
}

/**
 * Scraper interface.
 */
export interface IScraper {
  scrapeProduct(product: WatchlistProductInternal): Promise<ProductResult>;
  close(): Promise<void>;
}

/**
 * Notification state manager interface.
 */
export interface INotificationStateManager {
  updateTrackedState(productId: string, shopId: string, result: ProductResult): void;
  shouldNotify(productId: string, shopId: string): boolean;
  markNotified(productId: string, shopId: string, result: ProductResult): void;
}

/**
 * Notification service interface.
 */
export interface INotificationService {
  sendAlert(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): Promise<void>;
}

/**
 * Configuration for scan cycle runner.
 */
export interface ScanCycleConfig {
  scraperFactory: IScraperFactory;
  resultBuffer: ResultBuffer;
  stateManager: INotificationStateManager;
  notificationService: INotificationService;
  logger: IScanLogger;
}

/**
 * Runs scan cycles for Cheerio and Playwright engines.
 */
export class ScanCycleRunner {
  constructor(private config: ScanCycleConfig) {}

  /**
   * Runs Cheerio scan cycle (lightweight HTTP-based scraping).
   */
  async runCheerioScanCycle(
    shops: ShopConfig[],
    products: WatchlistProductInternal[]
  ): Promise<void> {
    const { cheerio: cheerioShops } = this.config.scraperFactory.groupByEngine(shops);

    if (cheerioShops.length === 0) {
      return;
    }

    this.config.logger.info('Starting Cheerio scan cycle', {
      shops: cheerioShops.length,
      products: products.length,
    });

    const startTime = Date.now();

    const shopTasks = cheerioShops.map((shop) => async () => {
      const productTasks = products.map((product) => async () => {
        try {
          await this.scanProduct(shop, product);
        } catch (error) {
          this.config.logger.error('Error scanning product', {
            product: product.id,
            shop: shop.id,
            engine: 'cheerio',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      await runWithConcurrency(productTasks, PRODUCT_CONCURRENCY);
    });

    await runWithConcurrency(shopTasks, CHEERIO_CONCURRENCY);

    this.logCycleCompletion('Cheerio', startTime);
  }

  /**
   * Runs Playwright scan cycle (browser-based scraping).
   */
  async runPlaywrightScanCycle(
    shops: ShopConfig[],
    products: WatchlistProductInternal[]
  ): Promise<void> {
    const { playwright: playwrightShops } = this.config.scraperFactory.groupByEngine(shops);

    if (playwrightShops.length === 0) {
      return;
    }

    this.config.logger.info('Starting Playwright scan cycle', {
      shops: playwrightShops.length,
      products: products.length,
    });

    const startTime = Date.now();
    let browser: Browser | null = null;

    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-sandbox',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
        ],
      });

      for (const shop of playwrightShops) {
        for (const product of products) {
          try {
            await this.scanProduct(shop, product, browser);
          } catch (error) {
            this.config.logger.error('Error scanning product', {
              product: product.id,
              shop: shop.id,
              engine: 'playwright',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    this.logCycleCompletion('Playwright', startTime);
  }

  /**
   * Scans a single product on a single shop.
   */
  private async scanProduct(
    shop: ShopConfig,
    product: WatchlistProductInternal,
    browser?: Browser
  ): Promise<void> {
    const scraper = this.config.scraperFactory.create(shop, this.config.logger, browser);

    try {
      const result = await scraper.scrapeProduct(product);

      this.config.logger.info('Product scanned', {
        product: product.id,
        shop: shop.id,
        price: result.price,
        available: result.isAvailable,
        url: result.productUrl,
      });

      // Buffer result for batch write
      this.config.resultBuffer.add(result);

      // Update tracked state
      this.config.stateManager.updateTrackedState(product.id, shop.id, result);

      // Check notification criteria
      await this.checkAndNotify(product, result, shop);
    } finally {
      await scraper.close();
    }
  }

  /**
   * Checks if notification should be sent and sends it.
   */
  private async checkAndNotify(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): Promise<void> {
    const meetsMaxPrice = result.price !== null && result.price <= product.price.max;
    const meetsAllCriteria = result.isAvailable && meetsMaxPrice;

    if (!meetsAllCriteria) {
      return;
    }

    const shouldNotify = this.config.stateManager.shouldNotify(product.id, shop.id);

    if (!shouldNotify) {
      return;
    }

    this.config.logger.info('Sending notification', {
      product: product.id,
      shop: shop.id,
      price: result.price,
    });

    try {
      await this.config.notificationService.sendAlert(product, result, shop);
      this.config.stateManager.markNotified(product.id, shop.id, result);
    } catch (error) {
      this.config.logger.error('Failed to send notification', {
        product: product.id,
        shop: shop.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Logs cycle completion with memory stats.
   */
  private logCycleCompletion(engine: string, startTime: number): void {
    const duration = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    this.config.logger.info(`${engine} scan cycle completed`, {
      durationMs: duration,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    });
  }
}
