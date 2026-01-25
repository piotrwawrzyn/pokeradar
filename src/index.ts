import * as dotenv from 'dotenv';
import * as path from 'path';
import { PriceMonitor } from './services/PriceMonitor';
import { SummaryService } from './services/SummaryService';
import { NotificationService } from './services/NotificationService';
import { FileShopRepository, FileWatchlistRepository, IShopRepository, IWatchlistRepository } from './repositories';

// Load environment variables
dotenv.config();

// Create repositories (swap these for different implementations, e.g. database)
const shopRepository: IShopRepository = new FileShopRepository(path.join(__dirname, 'config/shops'));
const watchlistRepository: IWatchlistRepository = new FileWatchlistRepository(path.join(__dirname, 'config/watchlist.json'));

/**
 * Main entry point for the Pokemon Price Monitor.
 */
async function main() {
  // Validate environment variables
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const intervalMs = parseInt(process.env.SCRAPE_INTERVAL_MS || '300000');
  const playwrightIntervalMs = parseInt(process.env.PLAYWRIGHT_SCRAPE_INTERVAL_MS || '600000');
  const summaryIntervalMs = parseInt(process.env.SUMMARY_INTERVAL_MS || '3600000');
  const logLevel = (process.env.LOG_LEVEL as 'info' | 'debug') || 'info';

  if (!telegramToken) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }

  if (!telegramChatId) {
    console.error('ERROR: TELEGRAM_CHAT_ID is not set in .env file');
    process.exit(1);
  }

  // Load startup info
  const shops = await shopRepository.getEnabled();
  const products = await watchlistRepository.getAll();
  const fastShops = shops.filter(s => !s.engine || s.engine === 'cheerio').length;
  const slowShops = shops.filter(s => s.engine === 'playwright').length;

  try {
    // Create and initialize monitor
    const monitor = new PriceMonitor(
      telegramToken,
      telegramChatId,
      shopRepository,
      watchlistRepository,
      intervalMs,
      logLevel,
      playwrightIntervalMs
    );

    // Send startup message using monitor's notification service (avoids extra TelegramBot instance)
    const notificationService = new NotificationService(telegramToken, telegramChatId);
    await notificationService.sendStartupMessage(
      fastShops,
      slowShops,
      intervalMs / 60000,
      playwrightIntervalMs / 60000,
      products
    );

    await monitor.initialize();

    // Setup summary service (temporary feature)
    const summaryService = new SummaryService(telegramToken, telegramChatId, summaryIntervalMs);
    monitor.setSummaryService(summaryService);
    summaryService.start();

    // Start monitoring
    monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\nShutting down gracefully...');
      monitor.stop();
      summaryService.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\nShutting down gracefully...');
      monitor.stop();
      summaryService.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
