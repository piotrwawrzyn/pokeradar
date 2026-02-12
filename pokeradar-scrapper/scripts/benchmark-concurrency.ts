import * as dotenv from 'dotenv';
import { getShopConfigDir } from '@pokeradar/shared';
import { ShopConfig, WatchlistProductInternal, ProductResult } from '../src/shared/types';
import { ScraperFactory } from '../src/scraper/scrapers';
import { Logger } from '../src/shared/logger';
import { FileShopRepository, MongoWatchlistRepository } from '../src/shared/repositories';
import { connectDB, disconnectDB } from '../src/infrastructure/database';

dotenv.config();

const shopRepository = new FileShopRepository(getShopConfigDir());

async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift()!;
      await task();
    }
  });
  await Promise.allSettled(workers);
}

async function scrapeProduct(
  shop: ShopConfig,
  product: WatchlistProductInternal,
  logger: Logger
): Promise<{ result: ProductResult | null; durationMs: number }> {
  const start = Date.now();
  const scraper = ScraperFactory.create(shop, logger);
  try {
    const result = await scraper.scrapeProduct(product);
    return { result, durationMs: Date.now() - start };
  } catch {
    return { result: null, durationMs: Date.now() - start };
  } finally {
    await scraper.close();
  }
}

/**
 * Mode 0: Fully sequential — one shop at a time, one product at a time
 */
async function benchmarkFullySequential(
  shops: ShopConfig[],
  products: WatchlistProductInternal[],
  logger: Logger
): Promise<{ totalMs: number; shopTimings: { shop: string; ms: number }[] }> {
  const shopTimings: { shop: string; ms: number }[] = [];
  const totalStart = Date.now();

  for (const shop of shops) {
    const shopStart = Date.now();
    for (const product of products) {
      await scrapeProduct(shop, product, logger);
    }
    shopTimings.push({ shop: shop.id, ms: Date.now() - shopStart });
  }

  return { totalMs: Date.now() - totalStart, shopTimings };
}

/**
 * Mode A: Current approach — parallel shops (10), sequential products within each shop
 */
async function benchmarkShopsParallelProductsSequential(
  shops: ShopConfig[],
  products: WatchlistProductInternal[],
  logger: Logger
): Promise<{ totalMs: number; shopTimings: { shop: string; ms: number }[] }> {
  const shopTimings: { shop: string; ms: number }[] = [];
  const totalStart = Date.now();

  const shopTasks = shops.map((shop) => async () => {
    const shopStart = Date.now();
    for (const product of products) {
      await scrapeProduct(shop, product, logger);
    }
    shopTimings.push({ shop: shop.id, ms: Date.now() - shopStart });
  });

  await runWithConcurrency(shopTasks, 10);

  return { totalMs: Date.now() - totalStart, shopTimings };
}

/**
 * Mode B: Parallel shops (10) + parallel products within each shop (3 concurrent)
 */
async function benchmarkShopsParallelProductsParallel(
  shops: ShopConfig[],
  products: WatchlistProductInternal[],
  logger: Logger,
  productConcurrency: number
): Promise<{ totalMs: number; shopTimings: { shop: string; ms: number }[] }> {
  const shopTimings: { shop: string; ms: number }[] = [];
  const totalStart = Date.now();

  const shopTasks = shops.map((shop) => async () => {
    const shopStart = Date.now();
    const productTasks = products.map((product) => async () => {
      await scrapeProduct(shop, product, logger);
    });
    await runWithConcurrency(productTasks, productConcurrency);
    shopTimings.push({ shop: shop.id, ms: Date.now() - shopStart });
  });

  await runWithConcurrency(shopTasks, 10);

  return { totalMs: Date.now() - totalStart, shopTimings };
}

async function main() {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await connectDB(mongodbUri);
  const watchlistRepository = new MongoWatchlistRepository();

  const products = await watchlistRepository.getAll();
  const allShops = await shopRepository.getEnabled();
  const { cheerio: shops } = ScraperFactory.groupByEngine(allShops);

  const logger = new Logger('info', true); // silent mode

  console.log(`\nBenchmark: ${shops.length} cheerio shops x ${products.length} products = ${shops.length * products.length} requests\n`);

  // --- Mode 0: Fully sequential ---
  console.log('=== Mode 0: Fully sequential (no concurrency) ===');
  const s = await benchmarkFullySequential(shops, products, logger);
  console.log(`Total: ${(s.totalMs / 1000).toFixed(1)}s`);
  s.shopTimings.sort((x, y) => y.ms - x.ms);
  for (const t of s.shopTimings) {
    console.log(`  ${t.shop.padEnd(20)} ${(t.ms / 1000).toFixed(1)}s`);
  }

  console.log('');
  await new Promise(r => setTimeout(r, 3000));

  // --- Mode A: Current approach ---
  console.log('=== Mode A: Parallel shops (10), sequential products ===');
  const a = await benchmarkShopsParallelProductsSequential(shops, products, logger);
  console.log(`Total: ${(a.totalMs / 1000).toFixed(1)}s`);
  a.shopTimings.sort((x, y) => y.ms - x.ms);
  for (const t of a.shopTimings) {
    console.log(`  ${t.shop.padEnd(20)} ${(t.ms / 1000).toFixed(1)}s`);
  }

  console.log('');
  await new Promise(r => setTimeout(r, 3000));

  // --- Mode B: Parallel products (3 per shop) ---
  console.log('=== Mode B: Parallel shops (10) + parallel products (3) ===');
  const b = await benchmarkShopsParallelProductsParallel(shops, products, logger, 3);
  console.log(`Total: ${(b.totalMs / 1000).toFixed(1)}s`);
  b.shopTimings.sort((x, y) => y.ms - x.ms);
  for (const t of b.shopTimings) {
    console.log(`  ${t.shop.padEnd(20)} ${(t.ms / 1000).toFixed(1)}s`);
  }

  console.log('\n=== Summary ===');
  console.log(`Mode 0 (sequential):        ${(s.totalMs / 1000).toFixed(1)}s`);
  console.log(`Mode A (shop conc. 10):     ${(a.totalMs / 1000).toFixed(1)}s  (${((1 - a.totalMs / s.totalMs) * 100).toFixed(0)}% faster than sequential)`);
  console.log(`Mode B (+ product conc. 3): ${(b.totalMs / 1000).toFixed(1)}s  (${((1 - b.totalMs / s.totalMs) * 100).toFixed(0)}% faster than sequential)`);
  console.log('');

  await disconnectDB();
}

main().catch(error => {
  console.error('Benchmark error:', error);
  process.exit(1);
});
