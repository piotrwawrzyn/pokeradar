import * as fs from 'fs';
import * as path from 'path';
import { Watchlist, ShopConfig } from '../src/types';
import { ScraperFactory } from '../src/scrapers/ScraperFactory';
import { Logger } from '../src/services/Logger';
import { toInternalProducts } from '../src/utils/productUtils';

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
    shops = shops.filter(shop => shop.id.toLowerCase() === shopFilter || shop.name.toLowerCase().includes(shopFilter));

    if (shops.length === 0) {
      console.error(`\n❌ Shop "${shopFilter}" not found. Available shops: ${shopFiles.map(f => f.replace('.json', '')).join(', ')}\n`);
      process.exit(1);
    }
  }

  // Create logger (suppress debug logs)
  const logger = new Logger();

  console.log('\n🔍 Checking Watchlist Products\n');
  if (shopFilter) {
    console.log(`🏪 Shop: ${shops.map(s => s.name).join(', ')}\n`);
  } else {
    console.log(`🏪 Shops: ${shops.map(s => s.name).join(', ')}\n`);
  }
  console.log('='.repeat(80));
  console.log('');

  // Check each product against each shop
  for (const product of products) {
    console.log(`📦 ${product.name}`);
    console.log(`   Max Price: ${product.price.max} zł`);
    console.log('');

    for (const shop of shops) {
      const scraper = ScraperFactory.create(shop, logger);

      try {
        const result = await scraper.scrapeProduct(product);

        const availIcon = result.isAvailable ? '✅' : '❌';
        const priceStr = result.price !== null ? `${result.price.toFixed(2)} zł` : 'N/A';
        const meetsPrice = result.price !== null && result.price <= product.price.max;
        const priceIcon = result.price !== null ? (meetsPrice ? '💚' : '💔') : '  ';

        const status = result.isAvailable && meetsPrice ? '🎯 MATCH!' : '';

        console.log(`   ${availIcon} ${shop.name.padEnd(15)} - ${priceStr.padEnd(12)} ${priceIcon} ${status}`);

        if (result.productUrl && result.isAvailable && meetsPrice) {
          console.log(`      🔗 ${result.productUrl}`);
        }
      } catch (error) {
        console.log(`   ⚠️  ${shop.name.padEnd(15)} - Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');
    console.log('-'.repeat(80));
    console.log('');
  }

  console.log('✨ Check complete!');
  console.log('');
}

// Run the check
checkWatchlist().catch(error => {
  console.error('Error checking watchlist:', error);
  process.exit(1);
});
