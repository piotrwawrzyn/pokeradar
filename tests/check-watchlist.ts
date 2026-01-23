import * as fs from 'fs';
import * as path from 'path';
import { Browser } from 'playwright';
import { Watchlist, ShopConfig } from '../src/types';
import { ScraperFactory } from '../src/scrapers/ScraperFactory';
import { Logger } from '../src/services/Logger';
import { toInternalProducts } from '../src/utils/productUtils';

// Use playwright-extra with stealth plugin for bot detection evasion
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

/**
 * Checks all watchlist products against all shops and displays availability/prices
 */
async function checkWatchlist() {
  // Get optional shop filter from command line args
  const shopFilter = process.argv[2]?.toLowerCase();

  // Load watchlist
  const watchlistPath = path.join(__dirname, '../src/config/watchlist.json');
  const watchlist: Watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8'));
  const products = toInternalProducts(watchlist.products);

  // Load all shop configs
  const shopsDir = path.join(__dirname, '../src/config/shops');
  const shopFiles = fs.readdirSync(shopsDir).filter(f => f.endsWith('.json'));
  let shops: ShopConfig[] = shopFiles.map(file =>
    JSON.parse(fs.readFileSync(path.join(shopsDir, file), 'utf-8'))
  );

  // Filter shops if shop parameter provided
  if (shopFilter) {
    // When explicitly requesting a shop by name, allow testing disabled shops
    shops = shops.filter(shop => shop.id.toLowerCase() === shopFilter || shop.name.toLowerCase().includes(shopFilter));

    if (shops.length === 0) {
      console.error(`\n❌ Shop "${shopFilter}" not found. Available shops: ${shopFiles.map(f => f.replace('.json', '')).join(', ')}\n`);
      process.exit(1);
    }
  } else {
    // Filter out disabled shops only when running all shops
    shops = shops.filter(shop => !shop.disabled);
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
      console.log(`   Max Price: ${product.price.max} zł`);
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
}

async function checkProductAtShop(
  product: ReturnType<typeof toInternalProducts>[0],
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
      const meetsPrice = result.price <= product.price.max;

      const match = result.isAvailable && meetsPrice ? ' 🎯 MATCH!' : '';

      statusLine = `   ${availIcon} ${shop.name.padEnd(15)} - ${priceStr.padEnd(12)} ${availText.padEnd(11)}${match}`;

      if (result.productUrl && result.isAvailable && meetsPrice) {
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
