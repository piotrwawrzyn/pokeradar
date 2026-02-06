/**
 * baseline-record.ts - Records a baseline snapshot from live shop websites.
 *
 * Purpose:
 * - Connects to MongoDB to load watchlist and product sets
 * - Runs real scraping against all enabled shops (HTTP + browser)
 * - Saves HTML fixtures for every page visited
 * - Collects all ProductResults and timing data
 * - Saves baseline snapshot to _baseline.json
 *
 * Usage:
 *   npm run baseline:record                    # Record all shops and save baseline
 *   npm run baseline:record -- --shops letsgotry,basanti  # Record specific shops
 *   npm run baseline:record -- --compare       # Compare timing vs existing baseline (no save)
 *
 * Output:
 *   scripts/baseline/fixtures/{shopId}/*.html  - Saved HTML per shop
 *   scripts/baseline/fixtures/_baseline.json   - Golden results + watchlist + timing
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { connectDB, disconnectDB } from '../../src/infrastructure/database';
import { ProductSetModel } from '../../src/infrastructure/database/models';
import { FileShopRepository } from '../../src/shared/repositories/file/file-shop.repository';
import { MongoWatchlistRepository } from '../../src/shared/repositories/mongo/watchlist.repository';
import { Logger } from '../../src/shared/logger';
import { groupProductsBySet } from '../../src/shared/utils/product-utils';
import { ScanCycleRunner } from '../../src/scraper/monitoring/scan-cycle-runner';
import { ResultBuffer } from '../../src/scraper/monitoring/result-buffer';
import { WatchlistProductInternal, ProductResult, ShopConfig } from '../../src/shared/types';
import { FixtureStore } from './engines/fixture-store';
import { BaselineScraperFactory, TimingTracker } from './baseline-factory';
import { diffTiming } from './baseline-report';

// Load environment
dotenv.config();

/**
 * No-op dispatcher for baseline recording (we don't need notifications).
 */
class NoOpDispatcher {
  processResult(): void {
    // Do nothing
  }
}

/**
 * Baseline data structure saved to _baseline.json.
 */
interface BaselineSnapshot {
  recordedAt: string;
  products: WatchlistProductInternal[];
  productSets: Array<{ id: string; name: string; series: string }>;
  results: Array<Omit<ProductResult, 'timestamp'>>;  // Omit timestamp for easier diffs
  timing: {
    totalMs: number;
    perShop: Record<string, number>;
  };
}

/**
 * ANSI color codes for terminal output.
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
 * Parses CLI arguments for shop filtering and compare mode.
 */
function parseArgs(): { shops?: string[]; compare?: boolean } {
  const args = process.argv.slice(2);
  const shopsIndex = args.indexOf('--shops');
  const compare = args.includes('--compare');

  const result: { shops?: string[]; compare?: boolean } = {};

  if (shopsIndex !== -1 && args[shopsIndex + 1]) {
    const shopList = args[shopsIndex + 1];
    result.shops = shopList.split(',').map(s => s.trim());
  }

  if (compare) {
    result.compare = true;
  }

  return result;
}

/**
 * Prints timing comparison between baseline and current recording.
 */
function printTimingComparison(
  baselineTiming: { totalMs: number; perShop: Record<string, number> },
  currentTiming: { totalMs: number; perShop: Record<string, number> }
): void {
  console.log('\n' + colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + '  TIMING COMPARISON (BASELINE vs CURRENT)' + colors.reset);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  // Calculate overall change
  const totalChange = ((currentTiming.totalMs - baselineTiming.totalMs) / baselineTiming.totalMs) * 100;
  const totalChangeStr = totalChange >= 0 ? `+${totalChange.toFixed(1)}%` : `${totalChange.toFixed(1)}%`;
  const totalColor = Math.abs(totalChange) > 20 ? (totalChange > 0 ? colors.red : colors.green) : colors.blue;

  console.log(colors.bold + 'OVERALL:' + colors.reset);
  console.log(
    `  Baseline: ${(baselineTiming.totalMs / 1000).toFixed(1)}s\n` +
    `  Current:  ${(currentTiming.totalMs / 1000).toFixed(1)}s\n` +
    `  Change:   ` + totalColor + totalChangeStr + colors.reset + '\n'
  );

  // Per-shop comparison
  const timingDiff = diffTiming(baselineTiming.perShop, currentTiming.perShop);

  if (timingDiff.length === 0) {
    console.log(colors.gray + 'No shop timing data to compare' + colors.reset);
    return;
  }

  // Sort by change percentage (biggest changes first)
  timingDiff.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  console.log(colors.bold + 'PER-SHOP TIMING:' + colors.reset);
  console.log(colors.gray + 'Shop                 Baseline  Current   Change    Status' + colors.reset);
  console.log(colors.gray + '─'.repeat(60) + colors.reset);

  for (const t of timingDiff) {
    const baselineSec = (t.baselineMs / 1000).toFixed(1);
    const currentSec = (t.currentMs / 1000).toFixed(1);
    const changeStr = t.changePercent >= 0
      ? `+${t.changePercent.toFixed(0)}%`
      : `${t.changePercent.toFixed(0)}%`;

    let color = colors.blue;
    let status = 'OK';

    if (Math.abs(t.changePercent) > 50) {
      if (t.changePercent > 0) {
        color = colors.red;
        status = 'SLOWER';
      } else {
        color = colors.green;
        status = 'FASTER';
      }
    }

    console.log(
      `${t.shop.padEnd(20)} ${baselineSec.padStart(8)}s  ${currentSec.padStart(8)}s  ` +
      `${changeStr.padStart(8)}  ` +
      color + status.padEnd(10) + colors.reset
    );
  }

  // Summary
  const regressions = timingDiff.filter(t => t.isRegression).length;
  const improvements = timingDiff.filter(t => t.changePercent < -50).length;

  console.log('\n' + colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + 'SUMMARY:' + colors.reset);

  if (regressions > 0) {
    console.log(colors.red + `  ⚠ ${regressions} shop(s) significantly slower (>200%)` + colors.reset);
  }

  if (improvements > 0) {
    console.log(colors.green + `  ✓ ${improvements} shop(s) significantly faster (>50%)` + colors.reset);
  }

  if (regressions === 0 && improvements === 0) {
    console.log(colors.blue + `  → No significant timing changes` + colors.reset);
  }

  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');
}

/**
 * Main recording function.
 */
async function record() {
  const startTime = Date.now();

  console.log('━'.repeat(60));
  console.log('  BASELINE RECORDING');
  console.log('━'.repeat(60));
  console.log('');

  // Parse arguments
  const { shops: shopFilter, compare: compareMode } = parseArgs();

  // Load existing baseline if in compare mode
  let existingBaseline: BaselineSnapshot | null = null;
  if (compareMode) {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const baselinePath = path.join(fixturesDir, '_baseline.json');

    if (!fs.existsSync(baselinePath)) {
      console.error('❌ Cannot compare: baseline not found at', baselinePath);
      console.error('');
      console.error('Run "npm run baseline:record" first to create a baseline.');
      process.exit(1);
    }

    const content = fs.readFileSync(baselinePath, 'utf-8');
    existingBaseline = JSON.parse(content);

    const recordedDate = new Date(existingBaseline.recordedAt).toLocaleString();
    console.log(`📅 Compare mode: will compare against baseline recorded ${recordedDate}\n`);
  }

  // Validate environment
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    console.error('❌ ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  // Initialize logger
  const logger = new Logger('baseline-record.log', 'info');

  // Connect to MongoDB
  console.log('📡 Connecting to MongoDB...');
  await connectDB(mongodbUri);
  console.log('✓ MongoDB connected\n');

  try {
    // Load shops from files
    const shopRepository = new FileShopRepository(
      path.join(__dirname, '../../src/config/shops')
    );
    let shops = await shopRepository.getEnabled();

    // Apply shop filter if provided
    if (shopFilter) {
      shops = shops.filter(shop => shopFilter.includes(shop.id));
      console.log(`🔍 Filtering to shops: ${shopFilter.join(', ')}\n`);
    }

    if (shops.length === 0) {
      console.error('❌ No shops to record');
      process.exit(1);
    }

    console.log(`🏪 Loaded ${shops.length} shops: ${shops.map(s => s.id).join(', ')}\n`);

    // Load watchlist from MongoDB
    const watchlistRepository = new MongoWatchlistRepository();
    const products = await watchlistRepository.getAll();

    if (products.length === 0) {
      console.error('❌ No products in watchlist');
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

    // Group products by set
    const { setGroups, ungrouped } = groupProductsBySet(products, setMap);

    console.log(`📊 Grouped into ${setGroups.length} sets + ${ungrouped.length} ungrouped\n`);

    // Create baseline infrastructure
    const fixturesDir = path.join(__dirname, 'fixtures');
    const fixtureStore = new FixtureStore(fixturesDir);
    const timingTracker = new TimingTracker();
    const factory = new BaselineScraperFactory('record', fixtureStore, timingTracker);
    const resultBuffer = new ResultBuffer();
    const dispatcher = new NoOpDispatcher();

    const cycleRunner = new ScanCycleRunner({
      scraperFactory: factory,
      resultBuffer,
      dispatcher,
      logger,
    });

    // Run scraping
    console.log('🚀 Starting recording (this will take a few minutes)...\n');

    const scanStart = Date.now();

    await cycleRunner.runCheerioScanCycle(shops, setGroups, ungrouped);

    // Hint GC before Playwright
    if (global.gc) {
      global.gc();
    }

    await cycleRunner.runPlaywrightScanCycle(shops, setGroups, ungrouped);

    const scanDuration = Date.now() - scanStart;

    // Collect results - filter out products that weren't found (empty URL)
    const allResults = resultBuffer['buffer']; // Access private buffer via bracket notation
    const results = allResults.filter(r => r.productUrl !== '');

    console.log(`\n✓ Recording complete\n`);
    console.log(`📊 Recorded ${results.length} results from ${shops.length} shops (${allResults.length - results.length} not found, excluded)\n`);

    // Build current timing data
    const currentTiming = {
      totalMs: scanDuration,
      perShop: timingTracker.getAll(),
    };

    // If in compare mode, show timing comparison and exit without saving
    if (compareMode && existingBaseline) {
      printTimingComparison(existingBaseline.timing, currentTiming);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n⏱️  Comparison completed in ${duration}s`);
      console.log(colors.gray + '\nNote: Baseline was NOT modified (compare mode)\n' + colors.reset);

      return; // Exit without saving
    }

    // Build baseline snapshot
    const snapshot: BaselineSnapshot = {
      recordedAt: new Date().toISOString(),
      products,
      productSets: Array.from(setMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        series: data.series,
      })),
      results: results.map(r => ({
        productId: r.productId,
        shopId: r.shopId,
        productUrl: r.productUrl,
        price: r.price,
        isAvailable: r.isAvailable,
      })),
      timing: currentTiming,
    };

    // Save baseline
    const baselinePath = path.join(fixturesDir, '_baseline.json');
    fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2), 'utf-8');

    console.log(`💾 Saved baseline to: ${baselinePath}\n`);

    // Print summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log('━'.repeat(60));
    console.log(`✅ Recording completed in ${duration}s`);
    console.log('━'.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run "npm run baseline:check" to verify no differences');
    console.log('  2. Commit _baseline.json to git (fixtures/*.html are gitignored)');
    console.log('');
  } catch (error) {
    console.error('\n❌ Recording failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// Run the recording
record().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
