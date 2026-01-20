# Integration Tests

Integration tests for shop configurations to ensure selectors work correctly.

## Running Tests

```bash
# Run all shop tests
npm test

# Run specific shop test
npm run test:rebel
```

## Test Structure

Each shop has:
1. **Test fixture** (`fixtures/shopname.json`) - Contains test data
2. **Test file** (`shops/shopname.test.ts`) - Contains test cases

## What Gets Tested

For each shop configuration:

### Product Page Tests
- ✓ Title extraction works
- ✓ Price extraction works
- ✓ Availability detection works

### Search Page Tests
- ✓ Search returns articles
- ✓ URL extraction from first article works

## Adding a New Shop Test

1. Create shop config: `src/config/shops/newshop.json`

2. Create test fixture: `tests/fixtures/newshop.json`
```json
{
  "stableProductUrl": "https://shop.com/stable-product",
  "searchPhrase": "pokemon"
}
```

3. Create test file: `tests/shops/newshop.test.ts`
```typescript
import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { ShopConfig } from '../../src/types';
import { ShopTester } from '../helpers/testHelpers';

const config: ShopConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../src/config/shops/newshop.json'), 'utf-8')
);
const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/newshop.json'), 'utf-8')
);

test('newshop.com integration tests', async (t) => {
  const tester = new ShopTester(config);

  await t.before(async () => {
    await tester.setup();
  });

  await t.after(async () => {
    await tester.teardown();
  });

  // Add test cases (copy from rebel.test.ts)
});
```

4. Run tests:
```bash
npm test
```

## Choosing Stable Products

Pick products that:
- Are popular/evergreen (won't be removed)
- Are regularly in stock
- Have stable URLs
- Examples: Pokemon base sets, popular board games

## Test Output

```
🧪 Running Shop Integration Tests
==================================================

Testing rebel...
  ✓ Extracted price: 139.99 zł (from "139,99 zł")
  ✓ Found availability: "Produkt dostępny w magazynie"
  ✓ Extracted title: "Dixit | Rebel"
  ✓ Found 24 articles for "pokemon"
  ✓ Extracted URL: https://www.rebel.pl/...
  ✓ Extracted title from search: "Pokemon ..."
✅ rebel - PASSED

==================================================
📊 Test Summary
==================================================
✅ rebel
✅ otherShop
❌ brokenShop

Passed: 2/3 shops
```
