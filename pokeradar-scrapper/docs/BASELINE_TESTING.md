# Baseline Regression Testing

This project includes a simple baseline testing system to catch regressions in the scrapper.

## Quick Start

### Record a baseline (first time):

```bash
cd pokeradar-scrapper
npm run baseline
```

### Check for regressions (after code changes):

```bash
npm run baseline:check
```

- **Exit 0** = no regressions ✅
- **Exit 1** = regressions detected ⚠️

## What It Catches

- ✅ Selector breakage (website changes or config edits)
- ✅ Product matching regressions (fuzzy scoring, exclude logic)
- ✅ Search navigation bugs (URL building, candidate extraction)
- ✅ Price parsing bugs (format handling, null values)
- ✅ Engine-level regressions (extraction, fallback selectors)
- ✅ Set-based search bugs (grouping, exclusions)

## How It Works

The baseline system runs your **production scraping code** (no custom test engines) and saves/compares results:

**Recording:**

- Runs real production scraping against live shops (both Cheerio and Playwright)
- Saves results to `_baseline.json` (committed to git)
- No HTML fixtures - just the results

**Checking:**

- Runs production scraping again
- Compares results against `_baseline.json`
- Reports differences with color-coded output
- Exit 0 (pass) or 1 (fail)

## Commands

```bash
# Record baseline from live shops (saves to _baseline.json)
npm run baseline

# Check for regressions (compares current scraping against baseline)
npm run baseline:check

# Check single shop only (faster when working on one shop's config)
npm run baseline:check basanti
```

## When to Re-Record

Re-record the baseline when **inputs** change:

- ✅ Added/removed products from watchlist
- ✅ Added/removed shops
- ✅ Intentionally changed shop selectors
- ✅ Website HTML changed (not a bug, just an update)

Do **NOT** re-record when **code** changes — that's what `check` is for!

## Typical Workflows

**Initial setup:**

```bash
npm run baseline                  # Record baseline
npm run baseline:check            # Verify (should show 0 differences)
git add scripts/_baseline.json
git commit -m "Add baseline"
```

**Making code changes:**

```bash
# Make your changes...
npm run baseline:check            # Catch regressions
```

**Working on a single shop config:**

```bash
# Edit shop config...
npm run baseline:check pokesmart  # Fast check for just that shop
# If good, record full baseline:
npm run baseline                  # Updates entire baseline
```

## What Gets Compared

For each `(shopId, productId)` pair:

- **Price** - did it change unexpectedly?
- **Availability** - did it change unexpectedly?
- **Product URL** - did routing change?
- **Lost results** - products that were found before but not now (regression)
- **Gained results** - products that are newly found (might be good or bad)

Price and availability changes are **warnings** (shops update inventory), but URL changes and lost results are typically **regressions** indicating scraper bugs.

## CI/CD Integration

Add to your pipeline:

```yaml
- name: Run baseline check
  run: npm run baseline:check
```

Requires `scripts/_baseline.json` to be committed to git.
