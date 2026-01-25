import * as dotenv from 'dotenv';
import * as path from 'path';
import { PriceMonitor } from './services/PriceMonitor';
import { SummaryService } from './services/SummaryService';
import { NotificationService } from './services/NotificationService';
import {
  FileShopRepository,
  IShopRepository,
  IWatchlistRepository,
  INotificationStateRepository,
  IProductResultRepository,
  connectDB,
  disconnectDB,
  MongoWatchlistRepository,
  MongoNotificationStateRepository,
  MongoProductResultRepository
} from './repositories';

// Load environment variables
dotenv.config();

// Create file-based repositories (shops always from files per requirements)
const shopRepository: IShopRepository = new FileShopRepository(path.join(__dirname, 'config/shops'));

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
  const mongodbUri = process.env.MONGODB_URI;

  if (!telegramToken) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
  }

  if (!telegramChatId) {
    console.error('ERROR: TELEGRAM_CHAT_ID is not set in .env file');
    process.exit(1);
  }

  // MongoDB is required for watchlist storage
  if (!mongodbUri) {
    console.error('ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  // Initialize MongoDB connection and repositories
  let watchlistRepository: IWatchlistRepository;
  let notificationStateRepository: INotificationStateRepository;
  let productResultRepository: IProductResultRepository;

  try {
    await connectDB(mongodbUri);
    watchlistRepository = new MongoWatchlistRepository();
    notificationStateRepository = new MongoNotificationStateRepository();
    productResultRepository = new MongoProductResultRepository();
    console.log('MongoDB repositories initialized');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error instanceof Error ? error.message : String(error));
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
      playwrightIntervalMs,
      notificationStateRepository,
      productResultRepository
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
    const shutdown = async () => {
      console.log('\n\nShutting down gracefully...');
      monitor.stop();
      summaryService.stop();
      await disconnectDB();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown());
    process.on('SIGTERM', () => shutdown());
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
