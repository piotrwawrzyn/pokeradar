/**
 * Baseline reporting - diff computation and color-coded console output.
 *
 * Purpose:
 * - Compares current scraping results against baseline
 * - Identifies price changes, availability changes, URL changes, lost/gained products
 * - Compares timing to detect performance regressions
 * - Formats output with colors for easy human review
 */

import { ProductResult } from '../../src/shared/types';

/**
 * A result pair showing baseline vs current values.
 */
export interface ResultPair {
  productId: string;
  shopId: string;
  baseline: ProductResult;
  current: ProductResult;
}

/**
 * Categorized differences between baseline and current results.
 */
export interface ResultDiff {
  unchanged: ResultPair[];
  priceChanged: ResultPair[];
  availabilityChanged: ResultPair[];
  urlChanged: ResultPair[];
  lost: ProductResult[];      // In baseline but not in current
  gained: ProductResult[];    // In current but not in baseline
}

/**
 * Timing comparison for a single shop.
 */
export interface TimingDiff {
  shop: string;
  baselineMs: number;
  currentMs: number;
  changePercent: number;
  isRegression: boolean;  // true if >200% increase
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
 * Compares two sets of ProductResults and categorizes differences.
 *
 * @param baseline - Results from the recorded baseline
 * @param current - Results from the current run
 * @returns Categorized differences
 */
export function diffResults(baseline: ProductResult[], current: ProductResult[]): ResultDiff {
  // Index results by productId:shopId for fast lookup
  const baselineMap = new Map<string, ProductResult>();
  const currentMap = new Map<string, ProductResult>();

  for (const result of baseline) {
    const key = `${result.productId}:${result.shopId}`;
    baselineMap.set(key, result);
  }

  for (const result of current) {
    const key = `${result.productId}:${result.shopId}`;
    currentMap.set(key, result);
  }

  const diff: ResultDiff = {
    unchanged: [],
    priceChanged: [],
    availabilityChanged: [],
    urlChanged: [],
    lost: [],
    gained: [],
  };

  // Find changes and losses
  for (const [key, baselineResult] of baselineMap) {
    const currentResult = currentMap.get(key);

    if (!currentResult) {
      // Product was in baseline but not in current run
      diff.lost.push(baselineResult);
      continue;
    }

    // Compare fields
    const priceChanged = baselineResult.price !== currentResult.price;
    const availabilityChanged = baselineResult.isAvailable !== currentResult.isAvailable;
    const urlChanged = baselineResult.productUrl !== currentResult.productUrl;

    const pair: ResultPair = {
      productId: baselineResult.productId,
      shopId: baselineResult.shopId,
      baseline: baselineResult,
      current: currentResult,
    };

    if (priceChanged) {
      diff.priceChanged.push(pair);
    } else if (availabilityChanged) {
      diff.availabilityChanged.push(pair);
    } else if (urlChanged) {
      diff.urlChanged.push(pair);
    } else {
      diff.unchanged.push(pair);
    }
  }

  // Find gains
  for (const [key, currentResult] of currentMap) {
    if (!baselineMap.has(key)) {
      diff.gained.push(currentResult);
    }
  }

  return diff;
}

/**
 * Compares timing between baseline and current run.
 *
 * @param baseline - Per-shop timing from baseline (milliseconds)
 * @param current - Per-shop timing from current run (milliseconds)
 * @returns Array of timing comparisons
 */
export function diffTiming(
  baseline: Record<string, number>,
  current: Record<string, number>
): TimingDiff[] {
  const diffs: TimingDiff[] = [];

  const allShops = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const shop of allShops) {
    const baselineMs = baseline[shop] || 0;
    const currentMs = current[shop] || 0;

    if (baselineMs === 0 || currentMs === 0) {
      continue; // Skip if shop wasn't in one of the runs
    }

    const changePercent = ((currentMs - baselineMs) / baselineMs) * 100;
    const isRegression = changePercent > 200;

    diffs.push({
      shop,
      baselineMs,
      currentMs,
      changePercent,
      isRegression,
    });
  }

  return diffs;
}

/**
 * Prints a color-coded diff report to console.
 *
 * @param resultDiff - Categorized result differences
 * @param timingDiff - Per-shop timing comparisons
 */
export function printReport(resultDiff: ResultDiff, timingDiff: TimingDiff[]): void {
  console.log('\n' + colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + '  BASELINE REGRESSION REPORT' + colors.reset);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  // Timing section (only shown if timing data is available)
  if (timingDiff.length > 0) {
    console.log(colors.bold + 'TIMING' + colors.reset);
    for (const t of timingDiff) {
      const baselineSec = (t.baselineMs / 1000).toFixed(1);
      const currentSec = (t.currentMs / 1000).toFixed(1);
      const changeStr = t.changePercent >= 0
        ? `+${t.changePercent.toFixed(0)}%`
        : `${t.changePercent.toFixed(0)}%`;

      const color = t.isRegression ? colors.red : colors.green;
      const status = t.isRegression ? 'REGRESSION' : 'OK';

      console.log(
        `  ${t.shop.padEnd(20)} ${currentSec}s  (baseline: ${baselineSec}s, ${changeStr})  ` +
        color + status + colors.reset
      );
    }
    console.log('');
  }

  // Results section
  const totalChecks = resultDiff.unchanged.length +
                      resultDiff.priceChanged.length +
                      resultDiff.availabilityChanged.length +
                      resultDiff.urlChanged.length +
                      resultDiff.lost.length +
                      resultDiff.gained.length;

  console.log('\n' + colors.bold + 'RESULTS' + colors.reset + colors.gray + ` (${totalChecks} total checks)` + colors.reset);

  // Unchanged
  if (resultDiff.unchanged.length > 0) {
    console.log(colors.green + `  ✓ ${resultDiff.unchanged.length} unchanged` + colors.reset);
  }

  // Price changes
  if (resultDiff.priceChanged.length > 0) {
    console.log(colors.yellow + `  ⚠ ${resultDiff.priceChanged.length} price changes:` + colors.reset);
    for (const pair of resultDiff.priceChanged) {
      const oldPrice = pair.baseline.price !== null ? pair.baseline.price.toFixed(2) : 'null';
      const newPrice = pair.current.price !== null ? pair.current.price.toFixed(2) : 'null';
      const note = pair.current.price === null ? '(LOST PRICE)' : '';
      console.log(`    ${pair.productId} @ ${pair.shopId}: ${oldPrice} → ${newPrice} ${note}`);
    }
  }

  // Availability changes
  if (resultDiff.availabilityChanged.length > 0) {
    console.log(colors.yellow + `  ⚠ ${resultDiff.availabilityChanged.length} availability changes:` + colors.reset);
    for (const pair of resultDiff.availabilityChanged) {
      const oldAvail = pair.baseline.isAvailable ? 'available' : 'unavailable';
      const newAvail = pair.current.isAvailable ? 'available' : 'unavailable';
      console.log(`    ${pair.productId} @ ${pair.shopId}: ${oldAvail} → ${newAvail}`);
    }
  }

  // URL changes
  if (resultDiff.urlChanged.length > 0) {
    console.log(colors.yellow + `  ⚠ ${resultDiff.urlChanged.length} URL changes:` + colors.reset);
    for (const pair of resultDiff.urlChanged) {
      console.log(`    ${pair.productId} @ ${pair.shopId}:`);
      console.log(`      old: ${pair.baseline.productUrl}`);
      console.log(`      new: ${pair.current.productUrl}`);
    }
  }

  // Lost products
  if (resultDiff.lost.length > 0) {
    console.log(colors.red + `  ✗ ${resultDiff.lost.length} products lost:` + colors.reset);
    for (const result of resultDiff.lost) {
      const price = result.price !== null ? result.price.toFixed(2) : 'null';
      const avail = result.isAvailable ? 'available' : 'unavailable';
      console.log(`    ${result.productId} @ ${result.shopId} (was: ${price}, ${avail})`);
    }
  }

  // Gained products
  if (resultDiff.gained.length > 0) {
    console.log(colors.blue + `  + ${resultDiff.gained.length} products gained:` + colors.reset);
    for (const result of resultDiff.gained) {
      const price = result.price !== null ? result.price.toFixed(2) : 'null';
      const avail = result.isAvailable ? 'available' : 'unavailable';
      console.log(`    ${result.productId} @ ${result.shopId} (now: ${price}, ${avail})`);
    }
  }

  // Exit code summary
  console.log('\n' + colors.bold + '━'.repeat(60) + colors.reset);
  const hasDifferences = resultDiff.priceChanged.length > 0 ||
                         resultDiff.availabilityChanged.length > 0 ||
                         resultDiff.urlChanged.length > 0 ||
                         resultDiff.lost.length > 0 ||
                         resultDiff.gained.length > 0 ||
                         timingDiff.some(t => t.isRegression);

  if (hasDifferences) {
    console.log(colors.red + 'EXIT CODE: 1 (differences found)' + colors.reset);
  } else {
    console.log(colors.green + 'EXIT CODE: 0 (no differences)' + colors.reset);
  }

  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');
}

/**
 * Determines exit code based on diff results.
 *
 * @returns 0 if no differences, 1 if differences found
 */
export function getExitCode(resultDiff: ResultDiff, timingDiff: TimingDiff[]): number {
  const hasDifferences = resultDiff.priceChanged.length > 0 ||
                         resultDiff.availabilityChanged.length > 0 ||
                         resultDiff.urlChanged.length > 0 ||
                         resultDiff.lost.length > 0 ||
                         resultDiff.gained.length > 0 ||
                         timingDiff.some(t => t.isRegression);

  return hasDifferences ? 1 : 0;
}
