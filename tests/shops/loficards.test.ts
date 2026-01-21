import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { ShopConfig } from '../../src/types';
import { ShopTester } from '../helpers/testHelpers';

// Load shop config
const configPath = path.join(__dirname, '../../src/config/shops/loficards.json');
const config: ShopConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Load test fixture
const fixturePath = path.join(__dirname, '../fixtures/loficards.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

test('loficards.pl integration tests', async (t) => {
  const tester = new ShopTester(config);

  await t.before(async () => {
    await tester.setup();
  });

  await t.after(async () => {
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
    assert.ok(result.value?.availabilityText, 'Availability text should be extracted');
  });

  await t.test('Product Page - Title Extraction', async () => {
    const result = await tester.testTitleExtraction(fixture.stableProductUrl);

    assert.strictEqual(result.passed, true, result.error || 'Title extraction failed');
    assert.ok(result.value?.title, 'Title should be extracted');
  });
});
