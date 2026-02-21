/**
 * baseline.ts - Simple baseline testing using production scraping code.
 *
 * Purpose:
 * - Records production scraping results to _baseline.json
 * - Compares live scraping against saved baseline
 * - NO custom engines, NO HTML fixtures - just real production code
 *
 * Usage:
 *   npm run baseline                    # Record all shops → _baseline.json
 *   npm run baseline:check              # Compare all shops against baseline (exit 0/1)
 *   npm run baseline:check basanti      # Compare single shop against baseline
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { getShopConfigDir } from '@pokeradar/shared';
import { connectDB, disconnectDB } from '../src/infrastructure/database';
import { ProductSetModel } from '../src/infrastructure/database/models';
import { FileShopRepository } from '../src/shared/repositories/file/file-shop.repository';
import { MongoWatchlistRepository } from '../src/shared/repositories/mongo/watchlist.repository';
import { Logger } from '../src/shared/logger';
import { groupProductsBySet } from '../src/shared/utils/product-utils';
import { loadAndResolveProducts } from '../src/shared/utils/search-resolver';
import {
  ScanCycleRunner,
  IScraperFactory,
  IMultiUserDispatcher,
} from '../src/scraper/monitoring/scan-cycle-runner';
import { ResultBuffer } from '../src/scraper/monitoring/result-buffer';
import { ScraperFactory } from '../src/scraper/scrapers/scraper-factory';
import { WatchlistProductInternal, ProductResult, ShopConfig } from '../src/shared/types';
import { IEngine } from '../src/scraper/engines/engine.interface';
import { IScraper } from '../src/scraper/scrapers/base/base-scraper';
import { Browser } from 'patchright';

dotenv.config();

/**
 * Baseline result (ProductResult without timestamp for stable diffs).
 */
interface BaselineResult {
  productId: string;
  shopId: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
}

/**
 * Baseline snapshot saved to _baseline.json.
 */
interface BaselineSnapshot {
  recordedAt: string;
  results: BaselineResult[];
  timing: {
    totalSeconds: number;
    perShop: Record<string, number>;
  };
  productCounts: {
    total: number;
    perShop: Record<string, number>;
  };
  requestCounts: {
    total: number;
    perShop: Record<string, number>;
  };
}

/**
 * No-op dispatcher (baseline doesn't need notifications).
 */
class NoOpDispatcher implements IMultiUserDispatcher {
  processResult(): void {
    // Do nothing
  }
}

/**
 * Request counter for tracking HTTP requests per shop.
 */
class RequestCounter {
  private counts: Record<string, number> = {};

  increment(shopId: string): void {
    this.counts[shopId] = (this.counts[shopId] || 0) + 1;
  }

  getAll(): Record<string, number> {
    return { ...this.counts };
  }

  getTotal(): number {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }
}

/**
 * Timing tracker for precise per-shop timing.
 * Accumulates time across multiple scraper calls for the same shop.
 */
class TimingTracker {
  private startTimes: Record<string, number> = {};
  private durations: Record<string, number> = {};

  start(shopId: string): void {
    this.startTimes[shopId] = Date.now();
  }

  end(shopId: string): void {
    if (this.startTimes[shopId]) {
      const durationSeconds = (Date.now() - this.startTimes[shopId]) / 1000;
      // Accumulate time for this shop
      this.durations[shopId] = (this.durations[shopId] || 0) + durationSeconds;
      delete this.startTimes[shopId];
    }
  }

  getAll(): Record<string, number> {
    // Round to 1 decimal place for display
    const rounded: Record<string, number> = {};
    for (const [shopId, duration] of Object.entries(this.durations)) {
      rounded[shopId] = parseFloat(duration.toFixed(1));
    }
    return rounded;
  }
}

/**
 * Engine wrapper that counts goto() calls (HTTP requests).
 */
class RequestCountingEngine implements IEngine {
  constructor(
    private wrapped: IEngine,
    private shopId: string,
    private counter: RequestCounter,
  ) {}

  async goto(url: string): Promise<void> {
    this.counter.increment(this.shopId);
    return this.wrapped.goto(url);
  }

  getCurrentUrl(): string | null {
    return this.wrapped.getCurrentUrl();
  }

  async extract(selector: any): Promise<string | null> {
    return this.wrapped.extract(selector);
  }

  async extractAll(selector: any): Promise<any[]> {
    return this.wrapped.extractAll(selector);
  }

  async exists(selector: any): Promise<boolean> {
    return this.wrapped.exists(selector);
  }

  async close(): Promise<void> {
    return this.wrapped.close();
  }
}

/**
 * Navigator wrapper that tracks timing for search operations.
 */
class TimedNavigator {
  constructor(
    private wrapped: any,
    private shopId: string,
    private timingTracker: TimingTracker,
  ) {}

  async extractSearchCandidates(searchPhrase: string): Promise<any[]> {
    this.timingTracker.start(this.shopId);
    try {
      return await this.wrapped.extractSearchCandidates(searchPhrase);
    } finally {
      this.timingTracker.end(this.shopId);
    }
  }

  async findProductUrl(product: WatchlistProductInternal): Promise<any> {
    this.timingTracker.start(this.shopId);
    try {
      return await this.wrapped.findProductUrl(product);
    } finally {
      this.timingTracker.end(this.shopId);
    }
  }

  matchProductFromCandidates(product: WatchlistProductInternal, candidates: any[]): any {
    // Matching is fast, no need to track timing
    return this.wrapped.matchProductFromCandidates(product, candidates);
  }
}

/**
 * Scraper wrapper that tracks timing per shop.
 */
class TimedScraper implements IScraper {
  private timedNavigator: TimedNavigator;

  constructor(
    private wrapped: IScraper,
    private shopId: string,
    private timingTracker: TimingTracker,
  ) {
    // Wrap the navigator to track search timing
    this.timedNavigator = new TimedNavigator(this.wrapped.getNavigator(), shopId, timingTracker);
  }

  async scrapeProduct(product: WatchlistProductInternal): Promise<ProductResult> {
    this.timingTracker.start(this.shopId);
    try {
      return await this.wrapped.scrapeProduct(product);
    } finally {
      this.timingTracker.end(this.shopId);
    }
  }

  async scrapeProductWithUrl(
    product: WatchlistProductInternal,
    url: string,
  ): Promise<ProductResult> {
    this.timingTracker.start(this.shopId);
    try {
      return await this.wrapped.scrapeProductWithUrl(product, url);
    } finally {
      this.timingTracker.end(this.shopId);
    }
  }

  createResultFromSearchData(
    product: WatchlistProductInternal,
    url: string,
    searchPageData: any,
  ): ProductResult {
    return this.wrapped.createResultFromSearchData(product, url, searchPageData);
  }

  getNavigator(): any {
    return this.timedNavigator;
  }

  async close(): Promise<void> {
    return this.wrapped.close();
  }
}

/**
 * Factory wrapper that creates scrapers with request-counting and timing.
 */
class InstrumentedScraperFactory {
  constructor(
    private requestCounter: RequestCounter,
    private timingTracker: TimingTracker,
  ) {}

  create(shop: ShopConfig, logger?: any, browser?: Browser): IScraper {
    // Import the engine types to wrap them
    const { CheerioEngine } = require('../src/scraper/engines/cheerio-engine');
    const { PlaywrightEngine } = require('../src/scraper/engines/playwright-engine');
    const { DefaultScraper } = require('../src/scraper/scrapers/default-scraper');

    // Create the appropriate engine
    let engine: IEngine;
    if (shop.engine === 'playwright') {
      engine = new PlaywrightEngine(shop, browser, logger);
    } else {
      engine = new CheerioEngine(shop, logger);
    }

    // Wrap the engine with request counting
    const countingEngine = new RequestCountingEngine(engine, shop.id, this.requestCounter);

    // Create the scraper with the wrapped engine
    const scraper = new DefaultScraper(shop, countingEngine, logger);

    // Wrap the scraper with timing tracking
    return new TimedScraper(scraper, shop.id, this.timingTracker);
  }

  groupByEngine(shops: ShopConfig[]): { cheerio: ShopConfig[]; playwright: ShopConfig[] } {
    return ScraperFactory.groupByEngine(shops);
  }
}

/**
 * ANSI color codes.
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

/**
 * Parses CLI arguments.
 */
function parseArgs(): { check: boolean; shopFilter?: string } {
  const args = process.argv.slice(2);
  const check = args.includes('--check');

  // Positional arg after --check is the shop filter
  const shopFilter = check && args.length > 1 ? args[args.length - 1] : undefined;

  return { check, shopFilter };
}

/**
 * Scraping result with timing metadata.
 */
interface ScrapingResult {
  results: BaselineResult[];
  timing: {
    totalSeconds: number;
    perShop: Record<string, number>;
  };
  productCounts: {
    total: number;
    perShop: Record<string, number>;
  };
  requestCounts: {
    total: number;
    perShop: Record<string, number>;
  };
}

/**
 * Runs production scraping and returns baseline results with timing.
 */
async function runScraping(
  shops: ShopConfig[],
  products: WatchlistProductInternal[],
  setMap: Map<string, { name: string; series: string }>,
  logger: Logger,
): Promise<ScrapingResult> {
  // Group products by set for efficient searching
  const { setGroups, ungrouped } = groupProductsBySet(products, setMap);

  // Create trackers
  const requestCounter = new RequestCounter();
  const timingTracker = new TimingTracker();

  // Create factory with request counting and timing
  const factory = new InstrumentedScraperFactory(requestCounter, timingTracker);
  const scraperFactory: IScraperFactory = {
    create: (shop, logger, browser) => factory.create(shop, logger, browser),
    groupByEngine: (shops) => factory.groupByEngine(shops),
  };

  const resultBuffer = new ResultBuffer();
  const dispatcher = new NoOpDispatcher();

  const cycleRunner = new ScanCycleRunner({
    scraperFactory,
    resultBuffer,
    dispatcher,
    logger,
  });

  console.log(`🚀 Running scraping for ${shops.length} shops...\n`);

  const startTime = Date.now();

  await cycleRunner.runCheerioScanCycle(shops, setGroups, ungrouped);

  // Hint GC before Playwright
  if (global.gc) {
    global.gc();
  }

  await cycleRunner.runPlaywrightScanCycle(shops, setGroups, ungrouped);

  const totalSeconds = (Date.now() - startTime) / 1000;

  // Extract results from buffer (access private field via bracket notation)
  const allResults: ProductResult[] = resultBuffer['buffer'];

  // Filter out not-found results (empty URL) and strip timestamps
  const baselineResults: BaselineResult[] = allResults
    .filter((r) => r.productUrl !== '')
    .map((r) => ({
      productId: r.productId,
      shopId: r.shopId,
      productUrl: r.productUrl,
      price: r.price,
      isAvailable: r.isAvailable,
    }))
    .sort((a, b) => {
      if (a.shopId !== b.shopId) return a.shopId.localeCompare(b.shopId);
      return a.productId.localeCompare(b.productId);
    });

  // Calculate per-shop product counts
  const perShopCounts: Record<string, number> = {};
  for (const result of baselineResults) {
    perShopCounts[result.shopId] = (perShopCounts[result.shopId] || 0) + 1;
  }

  // Get precise per-shop timing from tracker
  const perShopTiming = timingTracker.getAll();

  // Get request counts
  const requestCounts = requestCounter.getAll();
  const totalRequests = requestCounter.getTotal();

  // Ensure all shops that were scraped appear in all metrics (even with 0 results)
  // Collect all unique shop IDs from timing and requests
  const allScrapedShops = new Set<string>();
  Object.keys(perShopTiming).forEach((id) => allScrapedShops.add(id));
  Object.keys(requestCounts).forEach((id) => allScrapedShops.add(id));

  // Add missing shops to all metrics with 0 values
  for (const shopId of allScrapedShops) {
    if (!(shopId in perShopTiming)) {
      perShopTiming[shopId] = 0;
    }
    if (!(shopId in perShopCounts)) {
      perShopCounts[shopId] = 0;
    }
  }

  console.log(
    `\n✓ Scraping complete: ${baselineResults.length} results (${allResults.length - baselineResults.length} not found)\n`,
  );
  console.log(`⏱️  Total time: ${totalSeconds.toFixed(1)}s`);
  console.log(`🌐 Total requests: ${totalRequests}\n`);

  return {
    results: baselineResults,
    timing: {
      totalSeconds,
      perShop: perShopTiming,
    },
    productCounts: {
      total: baselineResults.length,
      perShop: perShopCounts,
    },
    requestCounts: {
      total: totalRequests,
      perShop: requestCounts,
    },
  };
}

/**
 * Saves baseline to _baseline.json.
 */
function saveBaseline(scrapingResult: ScrapingResult): void {
  const baselinePath = path.join(__dirname, '_baseline.json');

  const snapshot: BaselineSnapshot = {
    recordedAt: new Date().toISOString(),
    results: scrapingResult.results,
    timing: scrapingResult.timing,
    productCounts: scrapingResult.productCounts,
    requestCounts: scrapingResult.requestCounts,
  };

  fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2), 'utf-8');

  console.log(`💾 Saved baseline to: ${baselinePath}\n`);
  console.log(
    `📊 ${scrapingResult.results.length} results from ${Object.keys(scrapingResult.productCounts.perShop).length} shops\n`,
  );

  // Print per-shop breakdown - include all shops that were scraped (even with 0 results)
  console.log('Per-shop breakdown:');

  // Collect all unique shop IDs from timing, requests, and results
  const allShopIds = new Set<string>();
  Object.keys(scrapingResult.timing.perShop).forEach((id) => allShopIds.add(id));
  Object.keys(scrapingResult.requestCounts.perShop).forEach((id) => allShopIds.add(id));
  Object.keys(scrapingResult.productCounts.perShop).forEach((id) => allShopIds.add(id));

  // Sort and display all shops
  for (const shopId of Array.from(allShopIds).sort()) {
    const count = scrapingResult.productCounts.perShop[shopId] || 0;
    const timing = scrapingResult.timing.perShop[shopId]?.toFixed(1) || '0.0';
    const requests = scrapingResult.requestCounts.perShop[shopId] || 0;
    console.log(
      `  ${shopId.padEnd(20)} ${String(count).padStart(4)} results  ${timing.padStart(6)}s  ${String(requests).padStart(3)} requests`,
    );
  }
  console.log('');
}

/**
 * Loads baseline from _baseline.json.
 */
function loadBaseline(): BaselineSnapshot {
  const baselinePath = path.join(__dirname, '_baseline.json');

  if (!fs.existsSync(baselinePath)) {
    console.error(`❌ Baseline not found at: ${baselinePath}`);
    console.error(`\nRun "npm run baseline" first to create a baseline.\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(baselinePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Compares current results against baseline.
 * Returns true if differences found.
 */
function compareResults(
  baseline: BaselineResult[],
  current: BaselineResult[],
  shopFilter?: string,
): boolean {
  // Build maps keyed by "shopId:productId"
  const baselineMap = new Map<string, BaselineResult>();
  const currentMap = new Map<string, BaselineResult>();

  for (const r of baseline) {
    if (!shopFilter || r.shopId === shopFilter) {
      baselineMap.set(`${r.shopId}:${r.productId}`, r);
    }
  }

  for (const r of current) {
    if (!shopFilter || r.shopId === shopFilter) {
      currentMap.set(`${r.shopId}:${r.productId}`, r);
    }
  }

  // Categorize differences
  const priceChanged: Array<{ key: string; baseline: BaselineResult; current: BaselineResult }> =
    [];
  const availabilityChanged: Array<{
    key: string;
    baseline: BaselineResult;
    current: BaselineResult;
  }> = [];
  const urlChanged: Array<{ key: string; baseline: BaselineResult; current: BaselineResult }> = [];
  const lost: Array<{ key: string; result: BaselineResult }> = [];
  const gained: Array<{ key: string; result: BaselineResult }> = [];

  // Check for changes and losses
  for (const [key, baselineResult] of baselineMap) {
    const currentResult = currentMap.get(key);

    if (!currentResult) {
      lost.push({ key, result: baselineResult });
    } else {
      if (baselineResult.price !== currentResult.price) {
        priceChanged.push({ key, baseline: baselineResult, current: currentResult });
      }
      if (baselineResult.isAvailable !== currentResult.isAvailable) {
        availabilityChanged.push({ key, baseline: baselineResult, current: currentResult });
      }
      if (baselineResult.productUrl !== currentResult.productUrl) {
        urlChanged.push({ key, baseline: baselineResult, current: currentResult });
      }
    }
  }

  // Check for gains
  for (const [key, currentResult] of currentMap) {
    if (!baselineMap.has(key)) {
      gained.push({ key, result: currentResult });
    }
  }

  // Print report
  console.log(colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + '  BASELINE COMPARISON' + colors.reset);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  const hasDifferences =
    priceChanged.length +
      availabilityChanged.length +
      urlChanged.length +
      lost.length +
      gained.length >
    0;

  if (!hasDifferences) {
    console.log(
      colors.green + '✅ No differences found - baseline is stable!' + colors.reset + '\n',
    );
    return false;
  }

  // Print changes
  if (priceChanged.length > 0) {
    console.log(colors.yellow + `⚠️  PRICE CHANGED (${priceChanged.length}):` + colors.reset);
    for (const { key, baseline, current } of priceChanged.slice(0, 10)) {
      const [shopId, productId] = key.split(':');
      console.log(`  ${shopId} / ${productId}: ${baseline.price} → ${current.price}`);
    }
    if (priceChanged.length > 10) {
      console.log(colors.gray + `  ... and ${priceChanged.length - 10} more` + colors.reset);
    }
    console.log('');
  }

  if (availabilityChanged.length > 0) {
    console.log(
      colors.yellow + `⚠️  AVAILABILITY CHANGED (${availabilityChanged.length}):` + colors.reset,
    );
    for (const { key, baseline, current } of availabilityChanged.slice(0, 10)) {
      const [shopId, productId] = key.split(':');
      console.log(`  ${shopId} / ${productId}: ${baseline.isAvailable} → ${current.isAvailable}`);
    }
    if (availabilityChanged.length > 10) {
      console.log(colors.gray + `  ... and ${availabilityChanged.length - 10} more` + colors.reset);
    }
    console.log('');
  }

  if (urlChanged.length > 0) {
    console.log(colors.red + `❌ URL CHANGED (${urlChanged.length}):` + colors.reset);
    for (const { key, baseline, current } of urlChanged.slice(0, 5)) {
      const [shopId, productId] = key.split(':');
      console.log(`  ${shopId} / ${productId}:`);
      console.log(`    Was: ${baseline.productUrl}`);
      console.log(`    Now: ${current.productUrl}`);
    }
    if (urlChanged.length > 5) {
      console.log(colors.gray + `  ... and ${urlChanged.length - 5} more` + colors.reset);
    }
    console.log('');
  }

  if (lost.length > 0) {
    console.log(colors.red + `❌ LOST (${lost.length}):` + colors.reset);
    for (const { key, result } of lost.slice(0, 10)) {
      const [shopId, productId] = key.split(':');
      console.log(`  ${shopId} / ${productId} (was: ${result.productUrl})`);
    }
    if (lost.length > 10) {
      console.log(colors.gray + `  ... and ${lost.length - 10} more` + colors.reset);
    }
    console.log('');
  }

  if (gained.length > 0) {
    console.log(colors.green + `✅ GAINED (${gained.length}):` + colors.reset);
    for (const { key, result } of gained.slice(0, 10)) {
      const [shopId, productId] = key.split(':');
      console.log(`  ${shopId} / ${productId} (${result.productUrl})`);
    }
    if (gained.length > 10) {
      console.log(colors.gray + `  ... and ${gained.length - 10} more` + colors.reset);
    }
    console.log('');
  }

  console.log(colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + 'SUMMARY:' + colors.reset);
  console.log(`  Price changed:        ${priceChanged.length}`);
  console.log(`  Availability changed: ${availabilityChanged.length}`);
  console.log(`  URL changed:          ${urlChanged.length}`);
  console.log(`  Lost:                 ${lost.length}`);
  console.log(`  Gained:               ${gained.length}`);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  return true;
}

/**
 * Prints detailed product results: availability, price, and URL for each product.
 */
function printProductDetails(
  results: BaselineResult[],
  _allProducts: WatchlistProductInternal[],
  shopFilter?: string,
): void {
  const filtered = shopFilter ? results.filter((r) => r.shopId === shopFilter) : results;

  if (filtered.length === 0) return;

  console.log(colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + '  PRODUCT DETAILS' + colors.reset);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  const shopIds = [...new Set(filtered.map((r) => r.shopId))].sort();

  for (const shopId of shopIds) {
    const shopResults = filtered.filter((r) => r.shopId === shopId);

    console.log(
      colors.bold +
        `  ${shopId}` +
        colors.reset +
        colors.gray +
        ` (${shopResults.length} found)` +
        colors.reset,
    );

    for (const r of shopResults) {
      const status = r.isAvailable
        ? colors.green + 'AVAILABLE' + colors.reset
        : colors.red + 'UNAVAILABLE' + colors.reset;
      const price = r.price !== null ? `${r.price} PLN` : 'no price';
      console.log(
        `    ${status}  ${colors.yellow}${price.padEnd(12)}${colors.reset}  ${r.productId}`,
      );
      console.log(`${colors.gray}${''.padEnd(36)}${r.productUrl}${colors.reset}`);
    }

    console.log('');
  }
}

/**
 * Main function.
 */
async function main() {
  const startTime = Date.now();
  const { check, shopFilter } = parseArgs();

  console.log('━'.repeat(60));
  console.log(check ? '  BASELINE CHECK' : '  BASELINE RECORDING');
  if (shopFilter) {
    console.log(`  Shop: ${shopFilter}`);
  }
  console.log('━'.repeat(60));
  console.log('');

  // Validate environment
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    console.error('❌ ERROR: MONGODB_URI is not set in .env file\n');
    process.exit(1);
  }

  // Initialize logger
  const logLevel = (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info';
  const logger = new Logger('baseline.log', logLevel);

  // Connect to MongoDB
  console.log('📡 Connecting to MongoDB...');
  await connectDB(mongodbUri);
  console.log('✓ MongoDB connected\n');

  try {
    // Load shops from files
    const shopRepository = new FileShopRepository(getShopConfigDir());
    const allShops = await shopRepository.getAll();
    let shops = allShops.filter((shop) => !shop.disabled);

    // Apply shop filter if provided
    if (shopFilter) {
      shops = shops.filter((shop) => shop.id === shopFilter);
      if (shops.length === 0) {
        console.error(`❌ Shop not found: ${shopFilter}\n`);
        process.exit(1);
      }
      console.log(`🔍 Filtering to shop: ${shopFilter}\n`);
    }

    console.log(`🏪 Loaded ${shops.length} shops: ${shops.map((s) => s.id).join(', ')}\n`);

    // Load watchlist from MongoDB
    const watchlistRepository = new MongoWatchlistRepository();
    const products = await watchlistRepository.getAll();

    if (products.length === 0) {
      console.error('❌ No products in watchlist\n');
      process.exit(1);
    }

    console.log(`📦 Loaded ${products.length} products from watchlist\n`);

    // Load product sets for grouping
    const productSetDocs = await ProductSetModel.find().select('id name series').lean();
    const setMap = new Map<string, { name: string; series: string }>();
    for (const doc of productSetDocs) {
      setMap.set(doc.id, { name: doc.name, series: doc.series });
    }

    console.log(`🎴 Loaded ${setMap.size} product sets\n`);

    // Resolve search config for each product (merge with ProductType + set name)
    const { resolved: resolvedProducts } = await loadAndResolveProducts(products, setMap, logger);
    const unresolvedCount = products.length - resolvedProducts.length;
    if (unresolvedCount > 0) {
      console.log(`⚠️  Skipped ${unresolvedCount} products with no resolvable search config\n`);
    }

    console.log(`🔍 Resolved search config for ${resolvedProducts.length} products\n`);

    // Disconnect from MongoDB (no longer needed)
    await disconnectDB();

    // Run scraping
    const scrapingResult = await runScraping(shops, resolvedProducts, setMap, logger);

    if (check) {
      // Check mode: compare against baseline
      const baseline = loadBaseline();
      const hasDifferences = compareResults(baseline.results, scrapingResult.results, shopFilter);

      // Print detailed product results
      printProductDetails(scrapingResult.results, resolvedProducts, shopFilter);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏱️  Check completed in ${duration}s\n`);

      process.exit(hasDifferences ? 1 : 0);
    } else {
      // Record mode: save baseline
      if (shopFilter) {
        console.error('❌ Cannot use shop filter in record mode\n');
        console.error('Baseline recording always includes all shops.\n');
        console.error('Use "npm run baseline:check <shop>" to check a single shop.\n');
        process.exit(1);
      }

      saveBaseline(scrapingResult);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log('━'.repeat(60));
      console.log(`✅ Recording completed in ${duration}s`);
      console.log('━'.repeat(60));
      console.log('');
      console.log('Next steps:');
      console.log('  1. Run "npm run baseline:check" to verify');
      console.log('  2. Commit _baseline.json to git');
      console.log('');
    }
  } catch (error) {
    console.error('\n❌ Failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
