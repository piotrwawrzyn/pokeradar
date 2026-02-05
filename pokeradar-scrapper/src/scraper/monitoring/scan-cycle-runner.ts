/**
 * Scan cycle runner for executing scraping operations.
 * Supports set-based searching: one search per set per shop,
 * with individual fallback for unmatched or ungrouped products.
 */

import { Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../../shared/types';
import { SetGroup } from '../../shared/utils/product-utils';
import { IScraper } from '../scrapers/base/base-scraper';
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
 * Multi-user notification dispatcher interface.
 * Processes scrape results against all watching users.
 */
export interface IMultiUserDispatcher {
  processResult(product: WatchlistProductInternal, result: ProductResult, shop: ShopConfig): void;
}

/**
 * Configuration for scan cycle runner.
 */
export interface ScanCycleConfig {
  scraperFactory: IScraperFactory;
  resultBuffer: ResultBuffer;
  dispatcher: IMultiUserDispatcher;
  logger: IScanLogger;
}

/**
 * A product task resolved after set-based search phase.
 */
interface ProductTask {
  product: WatchlistProductInternal;
  /** If set, skip search and go directly to this URL. */
  resolvedUrl?: string;
}

/**
 * Runs scan cycles for Cheerio and Playwright engines.
 * Uses set-based searching to reduce HTTP requests.
 */
export class ScanCycleRunner {
  constructor(private config: ScanCycleConfig) {}

  /**
   * Runs Cheerio scan cycle with set-based search optimization.
   * Phase 1: Set searches (sequential, one scraper per shop).
   * Phase 2: Product page visits (concurrent, PRODUCT_CONCURRENCY per shop).
   */
  async runCheerioScanCycle(
    shops: ShopConfig[],
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[]
  ): Promise<void> {
    const { cheerio: cheerioShops } = this.config.scraperFactory.groupByEngine(shops);

    if (cheerioShops.length === 0) {
      return;
    }

    const totalProducts = setGroups.reduce((sum, g) => sum + g.products.length, 0) + ungroupedProducts.length;

    this.config.logger.info('Starting Cheerio scan cycle', {
      shops: cheerioShops.length,
      products: totalProducts,
      setGroups: setGroups.length,
      ungrouped: ungroupedProducts.length,
    });

    const startTime = Date.now();

    const shopTasks = cheerioShops.map((shop) => async () => {
      await this.scanShopConcurrent(shop, setGroups, ungroupedProducts);
    });

    await runWithConcurrency(shopTasks, CHEERIO_CONCURRENCY);

    this.logCycleCompletion('Cheerio', startTime);
  }

  /**
   * Runs Playwright scan cycle with set-based search optimization.
   * Playwright is sequential (one browser, one page at a time).
   */
  async runPlaywrightScanCycle(
    shops: ShopConfig[],
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[]
  ): Promise<void> {
    const { playwright: playwrightShops } = this.config.scraperFactory.groupByEngine(shops);

    if (playwrightShops.length === 0) {
      return;
    }

    const totalProducts = setGroups.reduce((sum, g) => sum + g.products.length, 0) + ungroupedProducts.length;

    this.config.logger.info('Starting Playwright scan cycle', {
      shops: playwrightShops.length,
      products: totalProducts,
      setGroups: setGroups.length,
      ungrouped: ungroupedProducts.length,
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
        await this.scanShopSequential(shop, setGroups, ungroupedProducts, browser);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    this.logCycleCompletion('Playwright', startTime);
  }

  /**
   * Scans a shop with product-level concurrency (Cheerio).
   * Phase 1: Use one scraper to do set searches and resolve URLs.
   * Phase 2: Run product tasks concurrently with separate scrapers.
   */
  private async scanShopConcurrent(
    shop: ShopConfig,
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[]
  ): Promise<void> {
    // Phase 1: Resolve set-based URLs using a single scraper
    const productTasks = await this.resolveSetSearches(shop, setGroups, ungroupedProducts);

    // Phase 2: Execute all product tasks concurrently
    const tasks = productTasks.map((task) => async () => {
      const scraper = this.config.scraperFactory.create(shop, this.config.logger);
      try {
        if (task.resolvedUrl) {
          const result = await scraper.scrapeProductWithUrl(task.product, task.resolvedUrl);
          this.handleResult(task.product, result, shop);
        } else {
          const result = await scraper.scrapeProduct(task.product);
          this.handleResult(task.product, result, shop);
        }
      } catch (error) {
        this.config.logger.error('Error scanning product', {
          product: task.product.id,
          shop: shop.id,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await scraper.close();
      }
    });

    await runWithConcurrency(tasks, PRODUCT_CONCURRENCY);
  }

  /**
   * Scans a shop sequentially (Playwright).
   * One scraper is reused for all products.
   */
  private async scanShopSequential(
    shop: ShopConfig,
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[],
    browser: Browser
  ): Promise<void> {
    const scraper = this.config.scraperFactory.create(shop, this.config.logger, browser);

    try {
      // Scan set-grouped products
      for (const setGroup of setGroups) {
        await this.scanSetGroup(scraper, shop, setGroup);
      }

      // Scan ungrouped products
      for (const product of ungroupedProducts) {
        await this.scanProductIndividual(scraper, shop, product);
      }
    } finally {
      await scraper.close();
    }
  }

  /**
   * Phase 1 for Cheerio: performs set searches with one scraper,
   * returns a list of product tasks with resolved URLs where possible.
   */
  private async resolveSetSearches(
    shop: ShopConfig,
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[]
  ): Promise<ProductTask[]> {
    const tasks: ProductTask[] = [];

    // Use one scraper for all set searches (sequential, lightweight)
    const searchScraper = this.config.scraperFactory.create(shop, this.config.logger);
    try {
      const navigator = searchScraper.getNavigator();

      for (const setGroup of setGroups) {
        try {
          const candidates = await navigator.extractSearchCandidates(setGroup.searchPhrase);

          this.config.logger.info('Set search completed', {
            shop: shop.id,
            setId: setGroup.setId,
            searchPhrase: setGroup.searchPhrase,
            candidates: candidates.length,
            products: setGroup.products.length,
          });

          for (const product of setGroup.products) {
            const matchedUrl = navigator.matchProductFromCandidates(product, candidates);
            if (matchedUrl) {
              tasks.push({ product, resolvedUrl: matchedUrl });
            } else {
              this.config.logger.info('Product not found in set search', {
                shop: shop.id,
                product: product.id,
                setId: setGroup.setId,
              });
              this.handleNotFound(product, shop);
            }
          }
        } catch (error) {
          this.config.logger.error('Set search failed, marking all products as not found', {
            shop: shop.id,
            setId: setGroup.setId,
            searchPhrase: setGroup.searchPhrase,
            error: error instanceof Error ? error.message : String(error),
          });

          for (const product of setGroup.products) {
            this.handleNotFound(product, shop);
          }
        }
      }
    } finally {
      await searchScraper.close();
    }

    // Add ungrouped products (no set — will use individual search)
    for (const product of ungroupedProducts) {
      tasks.push({ product });
    }

    return tasks;
  }

  /**
   * Scans a set group sequentially: one search, then match + scrape each product.
   * Used by Playwright path where concurrency isn't possible.
   */
  private async scanSetGroup(
    scraper: IScraper,
    shop: ShopConfig,
    setGroup: SetGroup
  ): Promise<void> {
    const navigator = scraper.getNavigator();

    try {
      const candidates = await navigator.extractSearchCandidates(setGroup.searchPhrase);

      this.config.logger.info('Set search completed', {
        shop: shop.id,
        setId: setGroup.setId,
        searchPhrase: setGroup.searchPhrase,
        candidates: candidates.length,
        products: setGroup.products.length,
      });

      for (const product of setGroup.products) {
        try {
          const matchedUrl = navigator.matchProductFromCandidates(product, candidates);

          if (matchedUrl) {
            const result = await scraper.scrapeProductWithUrl(product, matchedUrl);
            this.handleResult(product, result, shop);
          } else {
            this.config.logger.info('Product not found in set search', {
              shop: shop.id,
              product: product.id,
              setId: setGroup.setId,
            });
            this.handleNotFound(product, shop);
          }
        } catch (error) {
          this.config.logger.error('Error scanning set product', {
            product: product.id,
            shop: shop.id,
            setId: setGroup.setId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.config.logger.error('Set search failed, marking all products as not found', {
        shop: shop.id,
        setId: setGroup.setId,
        searchPhrase: setGroup.searchPhrase,
        error: error instanceof Error ? error.message : String(error),
      });

      for (const product of setGroup.products) {
        this.handleNotFound(product, shop);
      }
    }
  }

  /**
   * Scans a single product individually (standard search + scrape).
   */
  private async scanProductIndividual(
    scraper: IScraper,
    shop: ShopConfig,
    product: WatchlistProductInternal
  ): Promise<void> {
    try {
      const result = await scraper.scrapeProduct(product);
      this.handleResult(product, result, shop);
    } catch (error) {
      this.config.logger.error('Error scanning product', {
        product: product.id,
        shop: shop.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handles a product not found in set search — emits a null result without making any HTTP requests.
   */
  private handleNotFound(
    product: WatchlistProductInternal,
    shop: ShopConfig
  ): void {
    const result: ProductResult = {
      productId: product.id,
      shopId: shop.id,
      productUrl: '',
      price: null,
      isAvailable: false,
      timestamp: new Date(),
    };
    this.handleResult(product, result, shop);
  }

  /**
   * Handles a scrape result: logs, buffers, and dispatches notifications.
   */
  private handleResult(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): void {
    this.config.logger.info('Product scanned', {
      product: product.id,
      shop: shop.id,
      price: result.price,
      available: result.isAvailable,
      url: result.productUrl,
    });

    this.config.resultBuffer.add(result);
    this.config.dispatcher.processResult(product, result, shop);
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
