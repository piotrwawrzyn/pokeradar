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
import { ShopCircuitBreaker } from './shop-circuit-breaker';

const CHEERIO_CONCURRENCY = 10;
const PRODUCT_CONCURRENCY = 3;

function countTotalProducts(
  setGroups: SetGroup[],
  ungroupedProducts: WatchlistProductInternal[]
): number {
  return setGroups.reduce((sum, g) => sum + g.products.length, 0) + ungroupedProducts.length;
}

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
  debug(message: string, meta?: Record<string, unknown>): void;
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
  /** If present, skip product page visit entirely and use this data. */
  searchPageData?: {
    price: number | null;
    isAvailable: boolean;
  };
}

/**
 * Statistics for a shop scan.
 */
interface ShopStats {
  shopId: string;
  found: number;
  notFound: number;
}

/**
 * Runs scan cycles for Cheerio and Playwright engines.
 * Uses set-based searching to reduce HTTP requests.
 */
export class ScanCycleRunner {
  private shopStats = new Map<string, ShopStats>();

  constructor(private config: ScanCycleConfig) {}

  private getOrCreateStats(shopId: string): ShopStats {
    let stats = this.shopStats.get(shopId);
    if (!stats) {
      stats = { shopId, found: 0, notFound: 0 };
      this.shopStats.set(shopId, stats);
    }
    return stats;
  }

  private resetStats(): void {
    this.shopStats.clear();
  }

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

    const totalProducts = countTotalProducts(setGroups, ungroupedProducts);

    this.config.logger.info('Starting Cheerio scan cycle', {
      shops: cheerioShops.length,
      products: totalProducts,
      setGroups: setGroups.length,
      ungrouped: ungroupedProducts.length,
    });

    const startTime = Date.now();
    const breaker = new ShopCircuitBreaker();
    this.resetStats();

    const shopTasks = cheerioShops.map((shop) => async () => {
      await this.scanShopConcurrent(shop, setGroups, ungroupedProducts, breaker);
    });

    await runWithConcurrency(shopTasks, CHEERIO_CONCURRENCY);

    this.logCycleCompletion('Cheerio', startTime, breaker);
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

    const totalProducts = countTotalProducts(setGroups, ungroupedProducts);

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
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });

      const breaker = new ShopCircuitBreaker();
      this.resetStats();

      for (const shop of playwrightShops) {
        await this.scanShopSequential(shop, setGroups, ungroupedProducts, browser, breaker);
      }

      this.logCycleCompletion('Playwright', startTime, breaker);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Scans a shop with product-level concurrency (Cheerio).
   * Phase 1: Use one scraper to do set searches and resolve URLs.
   * Phase 2: Run product tasks concurrently with separate scrapers.
   */
  private async scanShopConcurrent(
    shop: ShopConfig,
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[],
    breaker: ShopCircuitBreaker
  ): Promise<void> {
    // Phase 1: Resolve set-based URLs using a single scraper
    const productTasks = await this.resolveSetSearches(shop, setGroups, ungroupedProducts, breaker);

    // If breaker tripped, skip Phase 2 — all products already marked not found
    if (breaker.isTripped(shop.id)) {
      return;
    }

    // Phase 2: Execute all product tasks concurrently
    const tasks = productTasks.map((task) => async () => {
      const scraper = this.config.scraperFactory.create(shop, this.config.logger);
      try {
        if (task.searchPageData && task.searchPageData.price !== null) {
          // Use search page data directly - no HTTP request needed
          const result = scraper.createResultFromSearchData(
            task.product,
            task.resolvedUrl!,
            task.searchPageData
          );
          this.handleResult(task.product, result, shop);
        } else if (task.resolvedUrl) {
          // No search page data available (price/availability not extractable from search results),
          // making a separate request to the product page to get full details
          this.config.logger.debug('No search page data, visiting product page', {
            product: task.product.id,
            shop: shop.id,
            url: task.resolvedUrl,
          });
          const result = await scraper.scrapeProductWithUrl(task.product, task.resolvedUrl);
          if (result) {
            this.handleResult(task.product, result, shop);
          }
        // } else {
        //   // Individual fallback search — disabled for now (not optimal, too many requests)
        //   const result = await scraper.scrapeProduct(task.product);
        //   this.handleResult(task.product, result, shop);
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

    // Use per-shop concurrency if configured, otherwise use default
    const concurrency = shop.antiBot?.maxConcurrency ?? PRODUCT_CONCURRENCY;
    await runWithConcurrency(tasks, concurrency);
  }

  /**
   * Scans a shop sequentially (Playwright).
   * One scraper is reused for all products.
   */
  private async scanShopSequential(
    shop: ShopConfig,
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[],
    browser: Browser,
    breaker: ShopCircuitBreaker
  ): Promise<void> {
    const scraper = this.config.scraperFactory.create(shop, this.config.logger, browser);

    try {
      // Scan set-grouped products
      for (const setGroup of setGroups) {
        if (breaker.isTripped(shop.id)) {
          for (const product of setGroup.products) {
            this.handleNotFound(product, shop);
          }
          continue;
        }
        await this.scanSetGroup(scraper, shop, setGroup, breaker);
      }

      // If breaker tripped, skip ungrouped products
      if (breaker.isTripped(shop.id)) {
        for (const product of ungroupedProducts) {
          this.handleNotFound(product, shop);
        }
        return;
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
    ungroupedProducts: WatchlistProductInternal[],
    breaker: ShopCircuitBreaker
  ): Promise<ProductTask[]> {
    const tasks: ProductTask[] = [];

    // Use one scraper for all set searches (sequential, lightweight)
    const searchScraper = this.config.scraperFactory.create(shop, this.config.logger);
    try {
      const navigator = searchScraper.getNavigator();

      for (const setGroup of setGroups) {
        if (breaker.isTripped(shop.id)) {
          for (const product of setGroup.products) {
            this.handleNotFound(product, shop);
          }
          continue;
        }

        try {
          const candidates = await navigator.extractSearchCandidates(setGroup.searchPhrase);
          breaker.recordSuccess(shop.id);

          this.config.logger.debug('Set search completed', {
            shop: shop.id,
            setId: setGroup.setId,
            searchPhrase: setGroup.searchPhrase,
            candidates: candidates.length,
            products: setGroup.products.length,
          });

          for (const product of setGroup.products) {
            const match = navigator.matchProductFromCandidates(product, candidates);
            if (match) {
              tasks.push({
                product,
                resolvedUrl: match.url,
                searchPageData: match.searchPageData,
              });
            } else {
              this.config.logger.debug('Product not found in set search', {
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

          const justTripped = breaker.recordFailure(shop.id);
          if (justTripped) {
            this.config.logger.error('Circuit breaker tripped, skipping remaining searches', {
              shop: shop.id,
            });
          }
        }
      }
    } finally {
      await searchScraper.close();
    }

    // If breaker tripped, mark ungrouped as not found and skip Phase 2
    if (breaker.isTripped(shop.id)) {
      for (const product of ungroupedProducts) {
        this.handleNotFound(product, shop);
      }
      return [];
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
    setGroup: SetGroup,
    breaker: ShopCircuitBreaker
  ): Promise<void> {
    const navigator = scraper.getNavigator();

    try {
      const candidates = await navigator.extractSearchCandidates(setGroup.searchPhrase);
      breaker.recordSuccess(shop.id);

      this.config.logger.debug('Set search completed', {
        shop: shop.id,
        setId: setGroup.setId,
        searchPhrase: setGroup.searchPhrase,
        candidates: candidates.length,
        products: setGroup.products.length,
      });

      for (const product of setGroup.products) {
        try {
          const match = navigator.matchProductFromCandidates(product, candidates);

          if (match) {
            if (match.searchPageData && match.searchPageData.price !== null) {
              // Use search page data directly - no HTTP request needed
              const result = scraper.createResultFromSearchData(
                product,
                match.url,
                match.searchPageData
              );
              this.handleResult(product, result, shop);
            } else {
              const result = await scraper.scrapeProductWithUrl(product, match.url);
              if (result) {
                this.handleResult(product, result, shop);
              }
            }
          } else {
            this.config.logger.debug('Product not found in set search', {
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

      const justTripped = breaker.recordFailure(shop.id);
      if (justTripped) {
        this.config.logger.error('Circuit breaker tripped, skipping remaining searches', {
          shop: shop.id,
        });
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
      if (result) {
        this.handleResult(product, result, shop);
      }
    } catch (error) {
      this.config.logger.error('Error scanning product', {
        product: product.id,
        shop: shop.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Called when a product is not found in search or skipped due to circuit breaker.
   * No-op: unfound products are not stored or dispatched to avoid false state resets.
   */
  private handleNotFound(
    _product: WatchlistProductInternal,
    shop: ShopConfig
  ): void {
    // Intentionally empty — transient failures should not affect notification state
    const stats = this.getOrCreateStats(shop.id);
    stats.notFound++;
  }

  /**
   * Handles a scrape result: buffers and dispatches notifications.
   */
  private handleResult(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig
  ): void {
    this.config.resultBuffer.add(result);
    this.config.dispatcher.processResult(product, result, shop);
    const stats = this.getOrCreateStats(shop.id);
    stats.found++;
  }

  /**
   * Logs cycle completion with memory stats and per-shop results summary.
   */
  private logCycleCompletion(engine: string, startTime: number, breaker?: ShopCircuitBreaker): void {
    const duration = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    const trippedShops = breaker?.getTrippedShops() ?? [];

    // Log overall completion
    this.config.logger.info(`${engine} scan cycle completed`, {
      durationMs: duration,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      ...(trippedShops.length > 0 && { circuitBreakerTripped: trippedShops }),
    });

    // Log per-shop results summary
    const statsArray = Array.from(this.shopStats.values())
      .filter(s => s.found > 0 || s.notFound > 0)
      .sort((a, b) => a.shopId.localeCompare(b.shopId));

    if (statsArray.length > 0) {
      for (const stats of statsArray) {
        this.config.logger.info('Shop scan results', {
          shop: stats.shopId,
          found: stats.found,
          notFound: stats.notFound,
        });
      }
    }
  }
}
