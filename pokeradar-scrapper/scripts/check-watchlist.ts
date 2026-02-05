import * as dotenv from 'dotenv';
import * as path from 'path';
import { chromium, Browser } from 'playwright';
import { ShopConfig, WatchlistProductInternal } from '../src/shared/types';
import { ScraperFactory } from '../src/scraper/scrapers';
import { Logger } from '../src/shared/logger';
import { FileShopRepository, MongoWatchlistRepository } from '../src/shared/repositories';
import { connectDB, disconnectDB } from '../src/infrastructure/database';

// Load environment variables
dotenv.config();

// Create shop repository (still file-based)
const shopRepository = new FileShopRepository(path.join(__dirname, '../src/config/shops'));

/**
 * Checks all watchlist products against all shops and displays availability/prices
 */
async function checkWatchlist() {
  // Connect to MongoDB
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    console.error('ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  await connectDB(mongodbUri);
  const watchlistRepository = new MongoWatchlistRepository();

  // Get optional shop filter from command line args
  const shopFilter = process.argv[2]?.toLowerCase();

  // Load watchlist and shops via repositories
  const products = await watchlistRepository.getAll();
  let shops = await shopRepository.getEnabled();

  // Filter shops if shop parameter provided
  if (shopFilter) {
    shops = shops.filter(shop => shop.id.toLowerCase() === shopFilter || shop.name.toLowerCase().includes(shopFilter));

    if (shops.length === 0) {
      const allShops = await shopRepository.getAll();
      console.error(`\n❌ Shop "${shopFilter}" not found. Available shops: ${allShops.map(s => s.id).join(', ')}\n`);
      process.exit(1);
    }
  }

  // Create logger in silent mode (logs to file only, not console)
  const logger = new Logger('info', true);

  console.log('\n🔍 Checking Watchlist Products\n');
  if (shopFilter) {
    console.log(`🏪 Shop: ${shops.map(s => s.name).join(', ')}\n`);
  } else {
    console.log(`🏪 Shops: ${shops.map(s => s.name).join(', ')}\n`);
  }
  console.log('='.repeat(80));
  console.log('');

  // Group shops by engine type
  const { cheerio: cheerioShops, playwright: playwrightShops } = ScraperFactory.groupByEngine(shops);

  // Launch browser only if needed for Playwright shops
  let browser: Browser | null = null;
  if (playwrightShops.length > 0) {
    browser = await chromium.launch({ headless: true });
  }

  try {
    // Check each product against each shop
    for (const product of products) {
      console.log(`📦 ${product.name}`);
      console.log('');

      // Process Cheerio shops first (no browser needed)
      for (const shop of cheerioShops) {
        await checkProductAtShop(product, shop, logger);
      }

      // Process Playwright shops (with shared browser)
      for (const shop of playwrightShops) {
        await checkProductAtShop(product, shop, logger, browser!);
      }

      console.log('');
      console.log('-'.repeat(80));
      console.log('');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('✨ Check complete!');
  console.log('');

  await disconnectDB();
}

async function checkProductAtShop(
  product: WatchlistProductInternal,
  shop: ShopConfig,
  logger: Logger,
  browser?: Browser
) {
  const scraper = ScraperFactory.create(shop, logger, browser);

  try {
    const result = await scraper.scrapeProduct(product);

    // Determine status
    let statusLine = '';
    if (result.price === null) {
      // Product not found
      statusLine = `   ❌ ${shop.name.padEnd(15)} - Not found`;
    } else {
      // Product found
      const availIcon = result.isAvailable ? '✅' : '⛔';
      const availText = result.isAvailable ? 'Available' : 'Unavailable';
      const priceStr = `${result.price.toFixed(2)} zł`;


      statusLine = `   ${availIcon} ${shop.name.padEnd(15)} - ${priceStr.padEnd(12)} ${availText.padEnd(11)}`;

      if (result.productUrl && result.isAvailable) {
        console.log(statusLine);
        console.log(`      🔗 ${result.productUrl}`);
        return;
      }
    }

    console.log(statusLine);
  } catch (error) {
    console.log(`   ⚠️  ${shop.name.padEnd(15)} - Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await scraper.close();
  }
}

// Run the check
checkWatchlist().catch(error => {
  console.error('Error checking watchlist:', error);
  process.exit(1);
});
