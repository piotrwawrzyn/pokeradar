# Baseline Regression Testing

This project now includes a comprehensive baseline testing framework to catch regressions in the scrapper.

## Quick Start

### Record a baseline (first time):
```bash
cd pokeradar-scrapper
npm run baseline:record
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
- ✅ Performance regressions (timing >200% increase)

## How It Works

**Recording:**
- Hits real shops (HTTP + Playwright)
- Saves HTML fixtures for every page
- Creates `_baseline.json` with golden results

**Checking:**
- Replays saved HTML through current code (offline, fast)
- Compares results against baseline
- Reports differences with color-coded output

**Zero production code changes** — all test code lives in [scripts/baseline/](scripts/baseline/).

## Full Documentation

See [scripts/baseline/README.md](scripts/baseline/README.md) for:
- Complete architecture details
- Usage examples
- Troubleshooting guide
- CI/CD integration
- Development guide

## CI/CD Integration

Add to your pipeline:
```yaml
- name: Run baseline check
  run: npm run baseline:check
```

Requires `scripts/baseline/fixtures/_baseline.json` to be committed to git.

## When to Re-Record

Re-record the baseline when **inputs** change:
- ✅ Added/removed products from watchlist
- ✅ Added/removed shops
- ✅ Intentionally changed shop selectors
- ✅ Website HTML changed (not a bug, just an update)

Do **NOT** re-record when **code** changes — that's what `check` is for!

## Performance Testing (A/B Comparison)

To measure if your code changes improved or degraded performance, you have three options:

### Option 1: Quick In-Memory Comparison (Recommended)

Compare against the current baseline without modifying any files:

```bash
# Make your performance changes (optimize queries, add concurrency, etc.)

# Record and compare in one step (readonly mode - no files modified)
npm run baseline:record:compare
```

This runs live scraping to measure timing, compares against the baseline, but **does not save any files** (neither fixtures nor baseline.json). If you're happy with the results, run `npm run baseline:record` to save the new baseline.

### Option 2: Compare Two Saved Baselines

Save the current baseline, make changes, record a new one, and compare:

```bash
# Save current baseline
cp scripts/baseline/fixtures/_baseline.json _baseline-old.json

# Make changes and record new baseline
npm run baseline:record

# Compare the two
npm run baseline:compare _baseline-old.json scripts/baseline/fixtures/_baseline.json
```

### Option 3: Compare Against Git

Compare against the baseline from a previous commit:

```bash
# Make your performance changes

# Record new timing
npm run baseline:record

# Compare against previous commit
npm run baseline:compare <(git show HEAD:scripts/baseline/fixtures/_baseline.json) scripts/baseline/fixtures/_baseline.json
```

All comparison methods show per-shop timing and highlight:
- 🔴 Regressions (>200% slower)
- 🟢 Improvements (>50% faster)

## Quick Reference

### Commands

```bash
# Record baseline from live shops (saves to _baseline.json)
npm run baseline:record

# Record specific shops only
npm run baseline:record -- --shops letsgotry,basanti

# Record and compare timing (readonly - no files modified)
npm run baseline:record:compare

# Check for regressions (offline, fast)
npm run baseline:check

# Compare two saved baselines
npm run baseline:compare <before.json> <after.json>
```

### Typical Workflows

**Initial setup:**
```bash
npm run baseline:record           # Record baseline
npm run baseline:check             # Verify (should show 0 differences)
git add scripts/baseline/fixtures/_baseline.json
git commit -m "Add baseline"
```

**Making code changes:**
```bash
# Make your changes...
npm run baseline:check             # Catch regressions
```

**Performance optimization:**
```bash
# Make optimization changes...
npm run baseline:record:compare  # See if it's faster
# If happy with results:
npm run baseline:record          # Save new baseline
```
