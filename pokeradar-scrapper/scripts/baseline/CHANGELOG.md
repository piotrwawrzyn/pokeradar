# Baseline Framework Changelog

## Initial Release - 2026-02-06

### Features Implemented

✅ **Record & Replay Architecture**
- Records HTML fixtures from live shops (HTTP + Playwright)
- Replays fixtures offline for fast, deterministic testing
- Zero production code changes — all test code in `scripts/baseline/`

✅ **Comprehensive Coverage**
- Works with both Cheerio and Playwright shops
- Supports set-based search optimization
- Handles product matching, price parsing, availability checks
- Graceful handling of missing shops/products

✅ **Smart Comparison**
- Detects price changes, availability changes, URL changes
- Identifies lost/gained products
- Color-coded console output
- Exit code 0 (pass) or 1 (fail) for CI/CD

✅ **Documentation**
- Comprehensive README with usage examples
- Troubleshooting guide
- Quick start at project root

### Bugs Fixed

#### Bug #1: Framework included failed products in baseline
**Issue:** Products that weren't found during recording (empty URL) were saved to baseline, causing spurious "lost products" reports during check.

**Fix:** Filter out results with empty URLs before saving to `_baseline.json`
- File: `baseline-record.ts`
- Line: 183

#### Bug #2: Check compared against invalid baseline entries
**Issue:** Check script was comparing ALL products×shops (330 checks), including those that failed during recording, causing 185 false "gained products".

**Fix:**
- Filter baseline results to exclude shops without fixtures
- Filter baseline results to exclude empty URLs
- Only compare product:shop pairs that exist in baseline
- Files: `baseline-check.ts`
- Lines: 180-194

**Result:** Clean comparison (130 checks) with no spurious differences

#### Bug #3: URL redirect mismatch
**Issue:** Some shops redirect product URLs during recording. Fixtures were saved under the final redirected URL, but baseline stored the original matched URL. During replay, framework couldn't find fixtures → 15 "LOST PRICE" results.

**Example:**
- Recording navigates to: `shop.com/Product/123`
- Shop redirects to: `shop.com/product-slug-123`
- Fixture saved as: `shop-com-product-slug-123--hash.html`
- Baseline stores: `shop.com/Product/123`
- Replay tries to load: `shop.com/Product/123` → not found

**Fix:** Save fixtures under BOTH original and final URLs
- Files: `recording-cheerio-engine.ts`, `recording-playwright-engine.ts`
- CheerioEngine lines: 73-79
- PlaywrightEngine lines: 87-93

**Result:** URL redirects no longer cause fixture mismatches

#### Enhancement: Removed misleading timing comparison
**Issue:** Timing comparison showed replay (milliseconds) vs baseline (seconds), which is meaningless since replay is always ~100x faster.

**Fix:** Disabled timing comparison in check mode
- File: `baseline-check.ts`
- Line: 196-202
- File: `baseline-report.ts`
- Line: 183-202

**Result:** Cleaner output without noise

---

## Known Limitations

### Performance Testing
Timing comparison is not useful for detecting performance regressions in replay mode (fixtures from disk are always fast). To detect performance regressions:
1. Compare `baseline:record` runs over time
2. Manually compare timing sections in `_baseline.json`
3. Or implement a separate performance benchmarking script

### URL Normalization Edge Cases
If a shop does complex URL rewriting with session IDs or timestamps, fixtures may not match across recordings. Workaround: temporarily disable or manually test those shops.

---

## Migration from Old Baseline

If you recorded a baseline before the URL redirect fix (before 2026-02-06):

```bash
# Delete old fixtures
rm -rf scripts/baseline/fixtures/

# Re-record with fixed code
npm run baseline:record

# Verify
npm run baseline:check  # Should show EXIT CODE: 0
```

---

## Future Enhancements (Ideas)

- [ ] Add `--verbose` flag for debugging fixture loading
- [ ] Support recording only specific product+shop combinations
- [ ] Add fixture expiration (auto-detect stale fixtures)
- [ ] Performance benchmark mode (record-vs-record timing comparison)
- [ ] HTML diff viewer for investigating selector changes
- [ ] CI/CD integration examples for GitHub Actions, GitLab CI

---

## Credits

Built with zero production code changes, leveraging the existing scrapper's clean architecture and dependency injection patterns.
