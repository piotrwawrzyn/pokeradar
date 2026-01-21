import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { ShopConfig } from '../../src/types';
import { ShopTester } from '../helpers/testHelpers';

/**
 * Product page integration tests for all shops
 */
const fixturesDir = path.join(__dirname, '../fixtures');
const shopsConfigDir = path.join(__dirname, '../../src/config/shops');
const shopConfigFiles = fs.readdirSync(shopsConfigDir).filter(f => f.endsWith('.json'));

for (const configFile of shopConfigFiles) {
  const shopName = configFile.replace('.json', '');
  const configPath = path.join(shopsConfigDir, configFile);
  const fixturePath = path.join(fixturesDir, `${shopName}.json`);

  // Skip if no fixture exists
  if (!fs.existsSync(fixturePath)) {
    console.log(`Skipping ${shopName} - no fixture file found`);
    continue;
  }

  const config: ShopConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  test(`${config.name} - Product Page`, async (t) => {
    const tester = new ShopTester(config);

    t.before(async () => {
      await tester.setup();
    });

    t.after(async () => {
      await tester.teardown();
    });

    await t.test('Price Extraction', async () => {
      const result = await tester.testPriceExtraction(fixture.stableProductUrl);

      assert.strictEqual(result.passed, true, result.error || 'Price extraction failed');
      assert.ok(result.value?.price, 'Price should be extracted');
      assert.ok(result.value?.price > 0, 'Price should be greater than 0');
    });

    await t.test('Availability Check', async () => {
      const result = await tester.testAvailabilityExtraction(fixture.stableProductUrl);

      assert.strictEqual(result.passed, true, result.error || 'Availability check failed');
      assert.strictEqual(typeof result.value?.isAvailable, 'boolean', 'Availability should be a boolean');
    });
  });
}
