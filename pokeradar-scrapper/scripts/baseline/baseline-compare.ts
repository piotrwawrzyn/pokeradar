/**
 * baseline-compare.ts - Compares timing between two baseline recordings.
 *
 * Purpose:
 * - Detects performance regressions by comparing two recording runs
 * - Useful for A/B testing code changes impact on scraping performance
 * - Shows per-shop timing differences and overall impact
 *
 * Usage:
 *   # Save current baseline as backup
 *   cp scripts/baseline/fixtures/_baseline.json scripts/baseline/fixtures/_baseline-old.json
 *
 *   # Make code changes, then record new baseline
 *   npm run baseline:record
 *
 *   # Compare
 *   npm run baseline:compare scripts/baseline/fixtures/_baseline-old.json scripts/baseline/fixtures/_baseline.json
 *
 * Or use shortcuts:
 *   npm run baseline:compare before.json after.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { diffTiming, printReport } from './baseline-report';

interface BaselineSnapshot {
  recordedAt: string;
  timing: {
    totalMs: number;
    perShop: Record<string, number>;
    requestCounts?: Record<string, number>;
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
 * Loads baseline snapshot from a file.
 */
function loadBaseline(filepath: string): BaselineSnapshot {
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Prints timing comparison report.
 */
function printTimingReport(
  beforeFile: string,
  afterFile: string,
  before: BaselineSnapshot,
  after: BaselineSnapshot
): void {
  const beforeDate = new Date(before.recordedAt).toLocaleString();
  const afterDate = new Date(after.recordedAt).toLocaleString();

  console.log('\n' + colors.bold + '━'.repeat(60) + colors.reset);
  console.log(colors.bold + '  BASELINE TIMING COMPARISON' + colors.reset);
  console.log(colors.bold + '━'.repeat(60) + colors.reset + '\n');

  const beforeTotalRequests = Object.values(before.timing.requestCounts || {}).reduce((sum, count) => sum + count, 0);
  const afterTotalRequests = Object.values(after.timing.requestCounts || {}).reduce((sum, count) => sum + count, 0);

  console.log(colors.bold + 'BEFORE:' + colors.reset + ` ${beforeFile}`);
  console.log(`  Recorded: ${beforeDate}`);
  console.log(`  Total: ${(before.timing.totalMs / 1000).toFixed(1)}s`);
  console.log(`  Requests: ${beforeTotalRequests}`);
  console.log(`  Shops: ${Object.keys(before.timing.perShop).length}\n`);

  console.log(colors.bold + 'AFTER:' + colors.reset + ` ${afterFile}`);
  console.log(`  Recorded: ${afterDate}`);
  console.log(`  Total: ${(after.timing.totalMs / 1000).toFixed(1)}s`);
  console.log(`  Requests: ${afterTotalRequests}`);
  console.log(`  Shops: ${Object.keys(after.timing.perShop).length}\n`);

  // Calculate overall change
  const totalChange = ((after.timing.totalMs - before.timing.totalMs) / before.timing.totalMs) * 100;
  const totalChangeStr = totalChange >= 0 ? `+${totalChange.toFixed(1)}%` : `${totalChange.toFixed(1)}%`;
  const totalColor = Math.abs(totalChange) > 20 ? (totalChange > 0 ? colors.red : colors.green) : colors.blue;

  const requestChange = beforeTotalRequests > 0
    ? ((afterTotalRequests - beforeTotalRequests) / beforeTotalRequests) * 100
    : 0;
  const requestChangeStr = requestChange >= 0 ? `+${requestChange.toFixed(1)}%` : `${requestChange.toFixed(1)}%`;
  const requestColor = Math.abs(requestChange) > 10 ? (requestChange > 0 ? colors.red : colors.green) : colors.blue;

  console.log(colors.bold + 'OVERALL:' + colors.reset);
  console.log(
    `  ${(before.timing.totalMs / 1000).toFixed(1)}s → ${(after.timing.totalMs / 1000).toFixed(1)}s ` +
    totalColor + `(${totalChangeStr})` + colors.reset
  );
  console.log(
    `  ${beforeTotalRequests} → ${afterTotalRequests} requests ` +
    requestColor + `(${requestChangeStr})` + colors.reset + '\n'
  );

  // Per-shop comparison
  const timingDiff = diffTiming(before.timing.perShop, after.timing.perShop);

  if (timingDiff.length === 0) {
    console.log(colors.gray + 'No shop timing data to compare' + colors.reset);
    return;
  }

  // Sort by change percentage (biggest changes first)
  timingDiff.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  console.log(colors.bold + 'PER-SHOP TIMING:' + colors.reset);
  console.log(colors.gray + 'Shop                 Before   After    Change    Requests  Status' + colors.reset);
  console.log(colors.gray + '─'.repeat(75) + colors.reset);

  for (const t of timingDiff) {
    const beforeSec = (t.baselineMs / 1000).toFixed(1);
    const afterSec = (t.currentMs / 1000).toFixed(1);
    const changeStr = t.changePercent >= 0
      ? `+${t.changePercent.toFixed(0)}%`
      : `${t.changePercent.toFixed(0)}%`;

    // Get request counts for this shop
    const beforeReqs = before.timing.requestCounts?.[t.shop] || 0;
    const afterReqs = after.timing.requestCounts?.[t.shop] || 0;
    const reqDiff = afterReqs - beforeReqs;
    const reqStr = reqDiff === 0 ? `${afterReqs}` :
                   reqDiff > 0 ? `${afterReqs} (+${reqDiff})` :
                   `${afterReqs} (${reqDiff})`;

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
      `${t.shop.padEnd(20)} ${beforeSec.padStart(6)}s  ${afterSec.padStart(6)}s  ` +
      `${changeStr.padStart(8)}  ${reqStr.padStart(10)}  ` +
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
 * Main comparison function.
 */
function compare() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npm run baseline:compare <before.json> <after.json>');
    console.error('');
    console.error('Example:');
    console.error('  cp scripts/baseline/fixtures/_baseline.json scripts/baseline/fixtures/_baseline-old.json');
    console.error('  # Make code changes');
    console.error('  npm run baseline:record');
    console.error('  npm run baseline:compare scripts/baseline/fixtures/_baseline-old.json scripts/baseline/fixtures/_baseline.json');
    console.error('');
    process.exit(1);
  }

  const beforeFile = args[0];
  const afterFile = args[1];

  // Resolve relative paths
  const beforePath = path.isAbsolute(beforeFile) ? beforeFile : path.resolve(process.cwd(), beforeFile);
  const afterPath = path.isAbsolute(afterFile) ? afterFile : path.resolve(process.cwd(), afterFile);

  const before = loadBaseline(beforePath);
  const after = loadBaseline(afterPath);

  printTimingReport(beforeFile, afterFile, before, after);
}

// Run the comparison
compare();
