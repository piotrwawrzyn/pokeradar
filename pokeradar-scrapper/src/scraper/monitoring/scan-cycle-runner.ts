/**
 * Scan cycle runner for executing scraping operations.
 * Uses reverse-matching pipeline: for each candidate, identify what it is,
 * then O(1) watchlist lookup. Per-shop deduplication across all set searches.
 */

import { Browser } from 'playwright';
import { ShopConfig, ProductResult } from '@pokeradar/shared';
import { WatchlistProductInternal } from '../../shared/types';
import { SetGroup } from '../../shared/utils/product-utils';
import { ProductCandidate, selectBestCandidate } from '../scrapers/base/helpers/candidate-selector';
import { IScraper } from '../scrapers/base/base-scraper';
import { ResultBuffer } from './result-buffer';
import { ShopCircuitBreaker } from './shop-circuit-breaker';
import { ProductMatchingPipeline } from '../../matching';

const CHEERIO_CONCURRENCY = 10;
const PRODUCT_CONCURRENCY = 3;
const TASK_TIMEOUT_MS = 120_000; // 2 minutes per product task
const SEARCH_PHASE_TIMEOUT_MS = 180_000; // 3 minutes for Phase 1 (search all sets for one shop)

/**
 * Wraps a promise with a timeout. Rejects with a TaskTimeoutError if the
 * promise doesn't settle within the given duration.
 */
export class TaskTimeoutError extends Error {
  constructor(ms: number) {
    super(`Task timed out after ${ms}ms`);
    this.name = 'TaskTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TaskTimeoutError(ms)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function countTotalProducts(
  setGroups: SetGroup[],
  ungroupedProducts: WatchlistProductInternal[],
): number {
  return setGroups.reduce((sum, g) => sum + g.products.length, 0) + ungroupedProducts.length;
}

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number,
  taskTimeoutMs: number = TASK_TIMEOUT_MS,
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()!;
      if (taskTimeoutMs > 0) {
        await withTimeout(task(), taskTimeoutMs);
      } else {
        await task();
      }
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
  /** Called after each shop completes scanning (both engines). Used to flush notifications early. */
  onShopComplete?: () => Promise<void>;
}

/**
 * A product task resolved after the candidate-accumulation phase.
 */
interface ProductTask {
  product: WatchlistProductInternal;
  /** Pre-resolved URL to the product page. */
  resolvedUrl: string;
  /** Raw product title from the shop's search results. */
  productTitle: string;
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
 * Uses pipeline reverse-matching with per-shop candidate deduplication.
 */
export class ScanCycleRunner {
  private shopStats = new Map<string, ShopStats>();
  private pipeline: ProductMatchingPipeline | null = null;
  private watchlistIndex: Map<string, WatchlistProductInternal[]> | null = null;

  constructor(private config: ScanCycleConfig) {}

  /**
   * Called by PriceMonitor after initialize() to provide pipeline + watchlist index.
   */
  setPipelineConfig(
    pipeline: ProductMatchingPipeline,
    watchlistIndex: Map<string, WatchlistProductInternal[]>,
  ): void {
    this.pipeline = pipeline;
    this.watchlistIndex = watchlistIndex;
  }

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
   * Runs Cheerio scan cycle.
   * Phase 1: Accumulate all candidates across all set searches (per shop).
   * Phase 2: Pipeline-match candidates → watchlist lookup → product page visits.
   */
  async runCheerioScanCycle(
    shops: ShopConfig[],
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[],
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
      await this.scanShopConcurrent(shop, setGroups, breaker);
      await this.config.onShopComplete?.();
    });

    await runWithConcurrency(shopTasks, CHEERIO_CONCURRENCY);

    this.logCycleCompletion('Cheerio', startTime, breaker);
  }

  /**
   * Runs Playwright scan cycle.
   * Playwright is sequential (one browser, one page at a time).
   */
  async runPlaywrightScanCycle(
    shops: ShopConfig[],
    setGroups: SetGroup[],
    ungroupedProducts: WatchlistProductInternal[],
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
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const breaker = new ShopCircuitBreaker();
      this.resetStats();

      for (const shop of playwrightShops) {
        await this.scanShopSequential(shop, setGroups, browser, breaker);
        await this.config.onShopComplete?.();
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
   * Phase 1: Accumulate all candidates from all set searches using a single scraper.
   * Phase 2: Run product tasks concurrently with separate scrapers.
   */
  private async scanShopConcurrent(
    shop: ShopConfig,
    setGroups: SetGroup[],
    breaker: ShopCircuitBreaker,
  ): Promise<void> {
    // Phase 1: Collect candidates across all set searches (with timeout).
    // The scraper is created here (not inside collectAndMatchCandidates) so we
    // can force-close it if the timeout fires — aborting in-flight HTTP requests
    // and preventing orphaned sockets from keeping the process alive.
    const searchScraper = this.config.scraperFactory.create(shop, this.config.logger);
    let productTasks: ProductTask[];
    try {
      productTasks = await withTimeout(
        this.collectAndMatchCandidatesWithScraper(searchScraper, shop, setGroups, breaker),
        SEARCH_PHASE_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof TaskTimeoutError) {
        this.config.logger.error('Search phase timed out, skipping shop', {
          shop: shop.id,
          timeoutMs: SEARCH_PHASE_TIMEOUT_MS,
        });
      } else {
        this.config.logger.error('Search phase failed', {
          shop: shop.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    } finally {
      await searchScraper.close();
    }

    // If breaker tripped, skip Phase 2
    if (breaker.isTripped(shop.id)) {
      return;
    }

    // Phase 2: Execute all product tasks concurrently.
    // The scraper is created OUTSIDE the timed work so that if the timeout
    // fires, we still close() the scraper (aborting in-flight HTTP requests).
    const tasks = productTasks.map((task) => async () => {
      const scraper = this.config.scraperFactory.create(shop, this.config.logger);
      try {
        await withTimeout(this.executeProductTask(scraper, task, shop), TASK_TIMEOUT_MS);
      } catch (error) {
        if (error instanceof TaskTimeoutError) {
          this.config.logger.error('Product task timed out', {
            shop: shop.id,
            product: task.product.id,
            url: task.resolvedUrl,
            timeoutMs: TASK_TIMEOUT_MS,
          });
        } else {
          this.config.logger.error('Error scanning product', {
            product: task.product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        await scraper.close();
      }
    });

    // Use per-shop concurrency if configured, otherwise use default
    const concurrency = shop.antiBot?.maxConcurrency ?? PRODUCT_CONCURRENCY;
    // No additional timeout in runWithConcurrency — each task handles its own
    await runWithConcurrency(tasks, concurrency, 0);
  }

  /**
   * Scans a shop sequentially (Playwright).
   * Accumulates candidates across all set searches, then resolves tasks sequentially.
   */
  private async scanShopSequential(
    shop: ShopConfig,
    setGroups: SetGroup[],
    browser: Browser,
    breaker: ShopCircuitBreaker,
  ): Promise<void> {
    const scraper = this.config.scraperFactory.create(shop, this.config.logger, browser);

    try {
      // Collect candidates via the single Playwright scraper
      const productTasks = await this.collectAndMatchCandidatesWithScraper(
        scraper,
        shop,
        setGroups,
        breaker,
      );

      if (breaker.isTripped(shop.id)) {
        return;
      }

      // Execute tasks sequentially
      for (const task of productTasks) {
        try {
          await this.executeProductTask(scraper, task, shop);
        } catch (error) {
          this.config.logger.error('Error scanning product', {
            product: task.product.id,
            shop: shop.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      await scraper.close();
    }
  }

  /**
   * Executes a single product task: either uses search page data directly
   * or visits the product page for full price/availability.
   */
  private async executeProductTask(
    scraper: IScraper,
    task: ProductTask,
    shop: ShopConfig,
  ): Promise<void> {
    if (
      task.searchPageData &&
      (task.searchPageData.price !== null || !task.searchPageData.isAvailable)
    ) {
      const result = scraper.createResultFromSearchData(
        task.product,
        task.resolvedUrl,
        task.searchPageData,
        task.productTitle,
      );
      this.handleResult(task.product, result, shop);
    } else {
      this.config.logger.debug('No search page data, visiting product page', {
        product: task.product.id,
        shop: shop.id,
        url: task.resolvedUrl,
      });
      const result = await scraper.scrapeProductWithUrl(
        task.product,
        task.resolvedUrl,
        task.productTitle,
      );
      if (result) {
        this.handleResult(task.product, result, shop);
      }
    }
  }

  /**
   * Accumulates all candidates from all set searches for a shop,
   * runs pipeline matching + watchlist lookup, returns product tasks.
   * Deduplication is automatic: same title from different searches → same typeId|setId key.
   */
  private async collectAndMatchCandidatesWithScraper(
    scraper: IScraper,
    shop: ShopConfig,
    setGroups: SetGroup[],
    breaker: ShopCircuitBreaker,
  ): Promise<ProductTask[]> {
    if (!this.pipeline || !this.watchlistIndex) {
      throw new Error('Pipeline not initialized — call setPipelineConfig() first');
    }

    // Accumulate all candidates per typeId|setId key across all set searches
    const allCandidates = new Map<string, ProductCandidate[]>();
    const navigator = scraper.getNavigator();

    for (const setGroup of setGroups) {
      if (breaker.isTripped(shop.id)) {
        break;
      }

      try {
        const candidates = await navigator.extractSearchCandidates(setGroup.searchPhrase);
        breaker.recordSuccess(shop.id);

        this.config.logger.debug('Set search completed', {
          shop: shop.id,
          setId: setGroup.setId,
          searchPhrase: setGroup.searchPhrase,
          candidates: candidates.length,
        });

        for (const candidate of candidates) {
          const matchResult = this.pipeline!.match(candidate.title);
          if (!matchResult) continue;

          const key = `${matchResult.productType.id}|${matchResult.productSet.id}`;
          const existing = allCandidates.get(key) ?? [];
          existing.push(candidate);
          allCandidates.set(key, existing);
        }
      } catch (error) {
        this.config.logger.error('Set search failed', {
          shop: shop.id,
          setId: setGroup.setId,
          searchPhrase: setGroup.searchPhrase,
          error: error instanceof Error ? error.message : String(error),
        });

        const justTripped = breaker.recordFailure(shop.id);
        if (justTripped) {
          this.config.logger.error('Circuit breaker tripped, skipping remaining searches', {
            shop: shop.id,
          });
        }
      }
    }

    if (breaker.isTripped(shop.id)) {
      return [];
    }

    // Phase 2: for each matched key, look up watchlist products and build tasks
    const tasks: ProductTask[] = [];

    for (const [key, candidates] of allCandidates.entries()) {
      const products = this.watchlistIndex!.get(key);
      if (!products || products.length === 0) continue;

      const best = selectBestCandidate(candidates);
      if (!best) continue;

      for (const product of products) {
        tasks.push({
          product,
          resolvedUrl: best.url,
          productTitle: best.title,
          searchPageData: best.searchPageData,
        });
      }
    }

    // Log not-found for watchlist products with no matching candidate
    const foundKeys = new Set(allCandidates.keys());
    for (const [key, products] of this.watchlistIndex!.entries()) {
      if (!foundKeys.has(key)) {
        for (const product of products) {
          this.getOrCreateStats(shop.id).notFound++;
          this.config.logger.debug('Product not found in any set search', {
            shop: shop.id,
            product: product.id,
          });
        }
      }
    }

    return tasks;
  }

  /**
   * Handles a scrape result: buffers and dispatches notifications.
   */
  private handleResult(
    product: WatchlistProductInternal,
    result: ProductResult,
    shop: ShopConfig,
  ): void {
    this.config.resultBuffer.add(result);
    this.config.dispatcher.processResult(product, result, shop);
    const stats = this.getOrCreateStats(shop.id);
    stats.found++;
  }

  /**
   * Logs cycle completion with memory stats and per-shop results summary.
   */
  private logCycleCompletion(
    engine: string,
    startTime: number,
    breaker?: ShopCircuitBreaker,
  ): void {
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
      .filter((s) => s.found > 0 || s.notFound > 0)
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
