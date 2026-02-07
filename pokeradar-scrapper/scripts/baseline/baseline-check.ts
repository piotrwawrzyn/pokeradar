/**
 * baseline-check.ts - Replays baseline fixtures and checks for regressions.
 *
 * Purpose:
 * - Loads baseline snapshot (_baseline.json) - no MongoDB needed
 * - Replays saved HTML fixtures through current code
 * - Compares results against baseline to detect regressions
 * - Reports differences with color-coded output
 * - Exits with code 0 (no changes) or 1 (differences found)
 *
 * Usage:
 *   npm run baseline:check
 *
 * Fully offline - no HTTP requests, no MongoDB, no browser automation.
 * Fast - completes in seconds instead of minutes.
 */

import * as path from 'path';
import * as fs from 'fs';
import { FileShopRepository } from '../../src/shared/repositories/file/file-shop.repository';
import { Logger } from '../../src/shared/logger';
import { groupProductsBySet } from '../../src/shared/utils/product-utils';
import { ScanCycleRunner } from '../../src/scraper/monitoring/scan-cycle-runner';
import { ResultBuffer } from '../../src/scraper/monitoring/result-buffer';
import { WatchlistProductInternal, ProductResult, ShopConfig } from '../../src/shared/types';
import { FixtureStore } from './engines/fixture-store';
import { BaselineScraperFactory, TimingTracker } from './baseline-factory';
import { diffResults, diffTiming, printReport, getExitCode } from './baseline-report';

/**
 * No-op dispatcher for baseline checking (we don't need notifications).
 */
class NoOpDispatcher {
  processResult(): void {
    // Do nothing
  }
}

/**
 * Baseline data structure loaded from _baseline.json.
 */
interface BaselineSnapshot {
  recordedAt: string;
  products: WatchlistProductInternal[];
  productSets: Array<{ id: string; name: string; series: string }>;
  results: Array<Omit<ProductResult, 'timestamp'>>;
  timing: {
    totalMs: number;
    perShop: Record<string, number>;
    requestCounts?: Record<string, number>;
  };
}

/**
 * Loads baseline snapshot from disk.
 */
function loadBaseline(fixturesDir: string): BaselineSnapshot {
  const baselinePath = path.join(fixturesDir, '_baseline.json');

  if (!fs.existsSync(baselinePath)) {
    console.error('❌ Baseline not found:', baselinePath);
    console.error('');
    console.error('Run "npm run baseline:record" first to create a baseline.');
    process.exit(1);
  }

  const content = fs.readFileSync(baselinePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Main checking function.
 */
async function check() {
  const startTime = Date.now();

  console.log('━'.repeat(60));
  console.log('  BASELINE REGRESSION CHECK');
  console.log('━'.repeat(60));
  console.log('');

  // Load baseline
  const fixturesDir = path.join(__dirname, 'fixtures');
  const baseline = loadBaseline(fixturesDir);

  const recordedDate = new Date(baseline.recordedAt).toLocaleString();
  console.log(`📅 Baseline recorded: ${recordedDate}\n`);

  // Load current shop configurations
  const shopRepository = new FileShopRepository(
    path.join(__dirname, '../../src/config/shops')
  );
  const allShops = await shopRepository.getEnabled();

  // Filter to shops that have fixtures (graceful handling)
  const fixtureStore = new FixtureStore(fixturesDir);
  const availableShopIds = new Set(
    fs.readdirSync(fixturesDir)
      .filter(name => {
        const fullPath = path.join(fixturesDir, name);
        return fs.statSync(fullPath).isDirectory();
      })
  );

  const shops: ShopConfig[] = [];
  const missingShops: string[] = [];

  for (const shop of allShops) {
    if (availableShopIds.has(shop.id)) {
      shops.push(shop);
    } else {
      missingShops.push(shop.id);
    }
  }

  if (missingShops.length > 0) {
    console.log(`⚠️  Warning: ${missingShops.length} shops have no fixtures (skipping):`);
    console.log(`    ${missingShops.join(', ')}\n`);
  }

  if (shops.length === 0) {
    console.error('❌ No shops with fixtures to check');
    process.exit(1);
  }

  console.log(`🏪 Checking ${shops.length} shops: ${shops.map(s => s.id).join(', ')}\n`);

  // Use baseline products and sets
  const setMap = new Map<string, { name: string; series: string }>();
  for (const set of baseline.productSets) {
    setMap.set(set.id, { name: set.name, series: set.series });
  }

  // Only include product+shop pairs that were in the baseline with non-empty URLs
  // This prevents replaying products that failed during recording
  const baselineProductIds = new Set(
    baseline.results.map(r => r.productId)
  );

  const products = baseline.products.filter(p => baselineProductIds.has(p.id));

  console.log(`📦 Checking ${products.length} products\n`);

  // Group products (same as baseline did)
  const { setGroups, ungrouped } = groupProductsBySet(products, setMap);

  console.log(`📦 Checking ${products.length} products (${setGroups.length} sets + ${ungrouped.length} ungrouped)\n`);

  // Create replay infrastructure
  const logger = new Logger('baseline-check.log', 'info');
  // Note: TimingTracker disabled in replay mode since timing comparison is meaningless
  // (replay from disk is always faster than real HTTP requests)
  const timingTracker = new TimingTracker();  // Still needed by factory interface
  const factory = new BaselineScraperFactory('replay', fixtureStore, timingTracker);
  const resultBuffer = new ResultBuffer();
  const dispatcher = new NoOpDispatcher();

  const cycleRunner = new ScanCycleRunner({
    scraperFactory: factory,
    resultBuffer,
    dispatcher,
    logger,
  });

  // Run replay (offline, fast)
  console.log('🔄 Replaying fixtures (this should be fast)...\n');

  const scanStart = Date.now();

  try {
    // In replay mode, all shops are cheerio (no playwright scan needed)
    await cycleRunner.runCheerioScanCycle(shops, setGroups, ungrouped);
  } catch (error) {
    console.error('\n❌ Replay failed:', error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('This usually means:');
    console.error('  - A fixture is missing (run baseline:record again)');
    console.error('  - Code expects different URLs than baseline recorded');
    console.error('');
    process.exit(1);
  }

  const scanDuration = Date.now() - scanStart;

  // Collect current results
  const currentResults = resultBuffer['buffer']; // Access private buffer

  console.log(`✓ Replay complete in ${(scanDuration / 1000).toFixed(1)}s\n`);

  // Compare results - filter baseline to only include shops with fixtures
  // and products that were actually found (non-empty URL)
  const baselineResults: ProductResult[] = baseline.results
    .filter(r => availableShopIds.has(r.shopId) && r.productUrl !== '')
    .map(r => ({
      ...r,
      timestamp: new Date(), // Dummy timestamp (not compared)
    }));

  // Build a set of valid product:shop pairs from baseline
  const baselineKeys = new Set(baselineResults.map(r => `${r.productId}:${r.shopId}`));

  // Filter current results to only include product:shop pairs that exist in baseline
  // This prevents false "gained" results for products that failed during recording
  const filteredCurrentResults = currentResults.filter(r => baselineKeys.has(`${r.productId}:${r.shopId}`));

  console.log(`🔍 Comparing ${baselineResults.length} baseline results vs ${filteredCurrentResults.length} current results\n`);

  const resultDiff = diffResults(baselineResults, filteredCurrentResults);

  // Get current request counts (meaningful even in replay mode - shows fixture access reduction)
  const currentRequestCounts = timingTracker.getAllRequestCounts();
  const baselineRequestCounts = baseline.timing.requestCounts || {};

  // Compare request counts
  console.log('━'.repeat(60));
  console.log('  REQUEST COUNT COMPARISON');
  console.log('━'.repeat(60) + '\n');

  const baselineTotalReqs = Object.values(baselineRequestCounts).reduce((sum, count) => sum + count, 0);
  const currentTotalReqs = Object.values(currentRequestCounts).reduce((sum, count) => sum + count, 0);

  if (baselineTotalReqs > 0 || currentTotalReqs > 0) {
    console.log(`Overall: ${baselineTotalReqs} → ${currentTotalReqs} (${currentTotalReqs - baselineTotalReqs >= 0 ? '+' : ''}${currentTotalReqs - baselineTotalReqs})\n`);

    // Per-shop comparison
    const allShopIds = new Set([...Object.keys(baselineRequestCounts), ...Object.keys(currentRequestCounts)]);
    for (const shopId of Array.from(allShopIds).sort()) {
      const baselineReqs = baselineRequestCounts[shopId] || 0;
      const currentReqs = currentRequestCounts[shopId] || 0;
      const diff = currentReqs - baselineReqs;
      if (diff !== 0 || baselineReqs > 0 || currentReqs > 0) {
        console.log(`  ${shopId.padEnd(20)} ${baselineReqs} → ${currentReqs} (${diff >= 0 ? '+' : ''}${diff})`);
      }
    }
    console.log('');
  } else {
    console.log('No request count data available\n');
  }

  // Note: Timing comparison is disabled for replay mode since replay is always faster
  // (fixtures from disk vs real HTTP). Timing is only useful for record-vs-record comparison.
  const timingDiff: any[] = [];

  // Print report
  printReport(resultDiff, timingDiff);

  // Exit with appropriate code (timing regressions not counted in replay mode)
  const exitCode = getExitCode(resultDiff, []);

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`Check completed in ${duration}s\n`);

  process.exit(exitCode);
}

// Run the check
check().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
