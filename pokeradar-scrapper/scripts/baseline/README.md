# Baseline Regression Testing Framework

A record & replay testing system for the pokeradar scrapper that catches regressions in scraping logic, selectors, parsers, and product matching — without modifying production code.

---

## Table of Contents

- [Quick Start](#quick-start)
- [What It Does](#what-it-does)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Usage Guide](#usage-guide)
- [What Gets Caught](#what-gets-caught)
- [When to Re-Record](#when-to-re-record)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

---

## Quick Start

### First Time Setup

1. **Record a baseline** (requires MongoDB + internet):
   ```bash
   npm run baseline:record
   ```
   This hits real shops, saves HTML fixtures, and creates `_baseline.json`.

2. **Verify the baseline**:
   ```bash
   npm run baseline:check
   ```
   Should report `EXIT CODE: 0 (no differences)`.

3. **Commit the baseline**:
   ```bash
   git add scripts/baseline/fixtures/_baseline.json
   git commit -m "Add baseline snapshot"
   ```

### After Code Changes

Before merging:
```bash
npm run baseline:check
```

- **Exit 0** = no regressions, safe to merge
- **Exit 1** = regressions detected, review the diff report

---

## What It Does

The baseline framework **freezes a known-good scraping run** and **replays it offline** to catch regressions.

### Recording (once)
- Connects to MongoDB to load watchlist + product sets
- Runs real scraping against all shops (HTTP + Playwright)
- Saves every fetched HTML page as a fixture
- Saves all results as `_baseline.json` (the golden snapshot)

### Checking (repeatedly)
- Loads `_baseline.json` (no MongoDB needed)
- Replays saved HTML through current code
- Compares results against baseline
- Reports differences with color-coded output

---

## How It Works

### Record & Replay Architecture

```
Recording (online, slow):
  MongoDB → Products/Sets → Real HTTP/Browser → HTML Saved → Results Saved

Checking (offline, fast):
  _baseline.json → Saved HTML → Current Code → Compare Results
```

### Key Insight

The system operates at the **`IEngine` interface** level. Production code (`DefaultScraper`, `ScanCycleRunner`, all parsers/matchers) is used unchanged. We inject **recording engines** (that save HTML) or **replay engines** (that serve saved HTML).

**Zero production code changes**. All test code lives in `scripts/baseline/`.

---

## Architecture

### Directory Structure

```
scripts/baseline/
  engines/
    fixture-store.ts              # Read/write HTML fixtures
    recording-cheerio-engine.ts   # IEngine that records Cheerio HTML
    recording-playwright-engine.ts # IEngine that records Playwright HTML
    replay-engine.ts              # IEngine that serves saved HTML
  fixtures/
    {shopId}/
      *.html                      # Saved HTML per shop
    _baseline.json                # Golden results (committed to git)
  baseline-factory.ts             # IScraperFactory for record/replay modes
  baseline-record.ts              # CLI: record baseline
  baseline-check.ts               # CLI: replay + diff
  baseline-report.ts              # Diff computation + color output
  README.md                       # This file
```

### Production Code Reused (Unchanged)

- `DefaultScraper` — accepts any `IEngine` via constructor
- `ScanCycleRunner` — orchestrates scanning, accepts `IScraperFactory`
- `ResultBuffer` — collects results in memory
- `FileShopRepository` — loads shop configs from JSON
- `groupProductsBySet()` — groups products for set-based search
- All selector/parsing/matching utilities

### Baseline-Specific Code

- **Recording Engines** — fetch HTML + save to fixtures
- **Replay Engine** — load HTML from fixtures (Cheerio-based)
- **BaselineScraperFactory** — creates scrapers with appropriate engines
- **Scripts** — CLI orchestration and reporting

---

## Usage Guide

### Recording a Baseline

**When to record:**
- First time setup
- After adding/removing products from watchlist
- After adding/removing shops
- After intentional selector changes
- When you want to update the golden snapshot

**Command:**
```bash
npm run baseline:record
```

**Optional: Record specific shops only** (for faster iteration):
```bash
npm run baseline:record -- --shops letsgotry,basanti
```

**What it does:**
1. Connects to MongoDB (reads watchlist + product sets)
2. Loads enabled shops from `src/config/shops/*.json`
3. Runs real scraping (makes HTTP requests, uses Playwright)
4. Saves HTML fixtures to `fixtures/{shopId}/*.html`
5. Saves results + timing to `fixtures/_baseline.json`

**Requirements:**
- MongoDB connection (MONGODB_URI in .env)
- Internet connection (hits live shops)
- ~2-5 minutes to complete (depends on shop count)

**Output:**
- `fixtures/{shopId}/*.html` — HTML files (gitignored, large)
- `fixtures/_baseline.json` — Golden results (commit this to git)

---

### Checking for Regressions

**When to check:**
- After any code change (engines, parsers, matchers, utils, selectors)
- Before merging a PR
- In CI/CD pipeline

**Command:**
```bash
npm run baseline:check
```

**What it does:**
1. Loads `_baseline.json` (no MongoDB needed)
2. Loads current shop configs
3. Replays saved HTML through current code (offline, fast)
4. Compares results against baseline
5. Prints color-coded diff report
6. Exits with code 0 (no changes) or 1 (differences found)

**Requirements:**
- `_baseline.json` must exist (run `baseline:record` first)
- HTML fixtures must exist (gitignored, but auto-checked)

**Speed:**
- Fully offline (no network, no MongoDB, no browser)
- Completes in seconds (vs minutes for real scraping)

---

### Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASELINE REGRESSION REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TIMING (replay vs baseline)
  letsgotry            0.3s  (baseline: 1.1s, -73%)  OK
  basanti              0.2s  (baseline: 0.9s, -78%)  OK
  pokesmart            0.4s  (baseline: 1.5s, -73%)  OK

RESULTS (3266 total checks)
  ✓ 3260 unchanged
  ⚠ 3 price changes:
    surging-sparks-etb @ letsgotry: 189.99 → null (LOST PRICE)
    prismatic-evolutions-bb @ basanti: 599.99 → 549.99
    shrouded-fable-etb @ pokesmart: 149.99 → null (LOST PRICE)
  ⚠ 2 availability changes:
    surging-sparks-etb @ letsgotry: available → unavailable
    prismatic-evolutions-bb @ flamberg: unavailable → available
  ✗ 1 products lost:
    twilight-masquerade-bb @ cardfan (was: 459.99, available)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXIT CODE: 1 (differences found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## What Gets Caught

### ✅ Selector Breakage
**Example:** Change `div.current-price span` to `div.price span` in `letsgotry.json`

**Detected as:** Price goes from `189.99` → `null` (LOST PRICE)

**Why:** Selector no longer matches the HTML

---

### ✅ Product Matching Regressions
**Example:** Change fuzzy threshold from 95 to 97 in `product-matcher.ts`

**Detected as:** Products lost (previously matched at 95-96%, now fail)

**Why:** Matching logic changed, fewer products match

---

### ✅ Search Navigation Bugs
**Example:** Refactor how search URLs are built in `search-navigator.ts`

**Detected as:** Products lost or URL changes

**Why:** Different URLs generated → different fixtures loaded → different results

---

### ✅ Price Parsing Bugs
**Example:** Break European format parsing in `price-parser.ts`

**Detected as:** Prices change to null across European shops

**Why:** Parser can't extract prices from the same HTML anymore

---

### ✅ Engine-Level Regressions
**Example:** Modify fallback selector logic in `CheerioEngine.extractAll()`

**Detected as:** Changes across multiple shops

**Why:** Core extraction logic affects all shops

---

### ✅ Set-Based Search Bugs
**Example:** Refactor `groupProductsBySet()` exclusion logic

**Detected as:** Products matched to wrong sets or URLs change

**Why:** Different grouping → different search phrases → different matches

---

### ❌ Performance Regressions (Timing)

**Status:** Not currently tracked in replay mode

**Why:** Timing comparison is disabled in `baseline:check` because:
- Baseline timing: Real HTTP requests (seconds)
- Replay timing: Fixtures from disk (milliseconds)
- Comparison is meaningless (replay is always 100x faster)

To detect performance regressions, use `baseline:compare`:

```bash
# 1. Record baseline (this is your "before" state)
npm run baseline:record

# 2. Make code changes (optimization, refactor, etc.)

# 3. Record again to a temporary file (this is your "after" state)
npm run baseline:record
cp scripts/baseline/fixtures/_baseline.json scripts/baseline/fixtures/_baseline-after.json

# 4. Restore original baseline
git checkout scripts/baseline/fixtures/_baseline.json

# 5. Compare timing
npm run baseline:compare scripts/baseline/fixtures/_baseline.json scripts/baseline/fixtures/_baseline-after.json
```

**Alternative workflow** (if you want to commit the optimized version):

```bash
# 1. Current baseline is your "before"
# 2. Make code changes
# 3. Record to see new timing
npm run baseline:record

# 4. Compare
npm run baseline:compare HEAD:scripts/baseline/fixtures/_baseline.json scripts/baseline/fixtures/_baseline.json

# 5. If timing improved, commit the new baseline
git add scripts/baseline/fixtures/_baseline.json
git commit -m "Optimize scraping - 30% faster"
```

This shows per-shop timing differences and highlights regressions (>200% slower) or improvements (>50% faster).

**Example output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BASELINE TIMING COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE: scripts/baseline/fixtures/_baseline-old.json
  Recorded: 2/6/2026, 10:00:00 AM
  Total: 120.5s
  Shops: 21

AFTER: scripts/baseline/fixtures/_baseline.json
  Recorded: 2/6/2026, 11:30:00 AM
  Total: 85.2s
  Shops: 21

OVERALL:
  120.5s → 85.2s (-29.3%)

PER-SHOP TIMING:
Shop                 Before   After    Change    Status
────────────────────────────────────────────────────────
tcgtrener              15.2s    4.8s     -68%  FASTER
rebel                  45.3s   12.1s     -73%  FASTER
rozetka                28.7s    8.9s     -69%  FASTER
letsgotry               2.1s    1.8s     -14%  OK
basanti                 3.5s    3.2s      -9%  OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY:
  ✓ 3 shop(s) significantly faster (>50%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### ❌ What It Does NOT Catch

- **Runtime crashes** (they'll cause the check script itself to fail)
- **Database write bugs** (we don't test MongoDB flush path)
- **Notification logic** (different system)
- **Live website changes** (that's not a code regression)
- **Performance regressions** (see above — requires record-vs-record comparison)

---

## When to Re-Record

### ✅ Re-record when inputs change:
- Added/removed products from watchlist
- Added/removed shops
- Intentionally changed shop selectors
- Website HTML changed (not a code bug, just an update)

### ❌ Do NOT re-record when:
- You changed code (that's what `check` is for!)
- You refactored internals
- You're testing a fix

### Graceful Handling

The `check` script handles input mismatches gracefully:
- **New shop with no fixtures** → skips it, warns: "Shop X has no fixtures — run baseline:record to include it"
- **New products** → skips them, warns
- **Removed shops** → only tests what's in baseline

This means `baseline:check` never breaks when you add shops or products — it just tests the subset it has and tells you to re-record for full coverage.

---

## Troubleshooting

### Error: "Baseline not found"
```
❌ Baseline not found: scripts/baseline/fixtures/_baseline.json
Run "npm run baseline:record" first to create a baseline.
```

**Fix:** Run `npm run baseline:record` first.

---

### Error: "Fixture not found for shop"
```
❌ Fixture not found for letsgotry: https://letsgotry.pl/search?q=Surging+Sparks
Expected file: fixtures/letsgotry/letsgotry-search-q-surging-sparks--a1b2c3d4.html
Run 'npm run baseline:record' to create fixtures.
```

**Cause:** Code changed how URLs are built → looking for a fixture that doesn't exist

**Fix:**
1. If URL change is intentional: re-record
2. If URL change is a bug: fix the code
3. Check for refactors in `search-navigator.ts` or `url-normalizer.ts`

---

### Multiple "LOST PRICE" results after first recording

**Symptom:** After recording baseline, immediate check shows many price changes like `379.00 → null (LOST PRICE)`

**Cause:** URL redirect mismatch — some shops redirect product URLs (e.g., `/p/Product/123` → `/p/product-slug/123`). During recording, fixtures are saved under the final URL after redirects, but the baseline stores the original matched URL. During replay, the framework tries to load using the original URL but the fixture is under the redirected URL.

**Fix:** Re-record the baseline:
```bash
npm run baseline:record
npm run baseline:check  # Should now show 0 differences
```

**Why this happens:**
- Some shops redirect product URLs during recording
- Old framework version saved fixtures only under the final URL
- **Fixed in current version** — now saves under both original and final URLs

If you see this after the fix:
1. Make sure you're using the latest framework code
2. Delete old fixtures: `rm -rf scripts/baseline/fixtures/`
3. Re-record fresh: `npm run baseline:record`

After re-recording with the fixed version, this issue should not recur.

---

### Warning: "X shops have no fixtures (skipping)"
```
⚠️  Warning: 2 shops have no fixtures (skipping):
    newshop, anothershop
```

**Cause:** New shops added to config but not yet recorded

**Fix:** Run `npm run baseline:record` to include them (or ignore if testing specific shops)

---

### All prices showing as null
**Cause:** Price parser is broken or selector changed globally

**Check:** Look for changes in `price-parser.ts` or `CheerioEngine.extractValue()`

---

### Many products lost
**Cause:** Product matching threshold changed or search navigator refactored

**Check:** Look for changes in `product-matcher.ts` or `search-navigator.ts`

---

## Development

### Adding Support for Pagination

When you add pagination support to the scrapper:

**No changes needed!** The framework operates at the `goto(url)` level.

**Recording:** Each page navigation gets saved as a fixture:
```
goto("shop.com/search?page=1")  → saved
goto("shop.com/search?page=2")  → saved
goto("shop.com/search?page=3")  → saved
goto("shop.com/product/abc")     → saved
```

**Replay:** The same URLs get replayed from fixtures.

**If you introduce a pagination bug** (e.g., page 2 URL is wrong), the ReplayEngine won't find the fixture → products lost → regression detected.

---

### Extending the Framework

#### Adding a New Recording Engine

1. Implement `IEngine` interface
2. In `goto()`, save HTML via `fixtureStore.saveHtml()`
3. Add to `BaselineScraperFactory.create()` logic

#### Adding a New Report Section

1. Add comparison logic to `baseline-report.ts`
2. Update `printReport()` to display new section
3. Update `getExitCode()` if needed

---

### File Organization

```
scripts/baseline/
  engines/           # IEngine implementations
  fixtures/          # Saved HTML + baseline
  baseline-*.ts      # CLI scripts + utilities
  README.md          # Documentation
```

**No production code is modified.** All baseline code lives in `scripts/`.

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Baseline Check

on: [push, pull_request]

jobs:
  baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run baseline check
        run: npm run baseline:check
```

**Note:** Requires `_baseline.json` to be committed. HTML fixtures are gitignored (re-recordable).

---

## Summary

✅ **Zero production code changes**
✅ **Fast offline regression checking** (seconds vs minutes)
✅ **Catches selector, parsing, matching, and logic bugs**
✅ **Works with Cheerio and Playwright shops**
✅ **Graceful handling of input changes**
✅ **Color-coded diff reports**
✅ **CI/CD ready**

**Workflow:**
1. Record baseline once (or when inputs change)
2. Check after every code change
3. Commit with confidence

---

## Questions?

Check the [plan document](../../.claude-work/plans/mighty-exploring-treehouse.md) for full implementation details.
