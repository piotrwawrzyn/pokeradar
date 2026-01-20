import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { ShopConfig } from '../src/types';
import { ShopTester } from './helpers/testHelpers';

/**
 * Dynamically loads and runs all shop tests
 */
const fixturesDir = path.join(__dirname, 'fixtures');

// Find all shop config files
const shopsConfigDir = path.join(__dirname, '../src/config/shops');
const shopConfigFiles = fs.readdirSync(shopsConfigDir).filter(f => f.endsWith('.json'));

for (const configFile of shopConfigFiles) {
  const shopName = configFile.replace('.json', '');
  const configPath = path.join(shopsConfigDir, configFile);
  const fixturePath = path.join(fixturesDir, `${shopName}.json`);

  // Skip if no fixture exists
  if (!fs.existsSync(fixturePath)) {
    console.log(`⚠️  Skipping ${shopName} - no fixture file found`);
    continue;
  }

  const config: ShopConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  test(`${shopName} integration tests`, async (t) => {
    const tester = new ShopTester(config);

    t.before(async () => {
      await tester.setup();
    });

    t.after(async () => {
      await tester.teardown();
    });

    await t.test('Product Page - Price Extraction', async () => {
      const result = await tester.testPriceExtraction(fixture.stableProductUrl);

      assert.strictEqual(result.passed, true, result.error || 'Price extraction failed');
      assert.ok(result.value?.price, 'Price should be extracted');
      assert.ok(result.value?.price > 0, 'Price should be greater than 0');
    });

    await t.test('Product Page - Availability Extraction', async () => {
      const result = await tester.testAvailabilityExtraction(fixture.stableProductUrl);

      assert.strictEqual(result.passed, true, result.error || 'Availability extraction failed');
      assert.ok(result.value?.availabilityText !== undefined, 'Availability should be checked');
    });

    await t.test('Product Page - Title Extraction', async () => {
      const result = await tester.testTitleExtraction(fixture.stableProductUrl);

      assert.strictEqual(result.passed, true, result.error || 'Title extraction failed');
      assert.ok(result.value?.title, 'Title should be extracted');
    });
  });
}
