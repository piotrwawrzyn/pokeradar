/**
 * Main entry point for the Pokemon Price Monitor.
 * Runs a single scan cycle and exits (designed for cron-based execution).
 */

console.log('[BOOT] Process starting', { pid: process.pid, node: process.version, cwd: process.cwd() });

import * as dotenv from 'dotenv';
import * as path from 'path';

// Infrastructure
import { connectDB, disconnectDB } from '../infrastructure/database';

// Shared
import {
  FileShopRepository,
  MongoWatchlistRepository,
  MongoNotificationStateRepository,
  MongoProductResultRepository,
  IShopRepository,
  IWatchlistRepository,
} from '../shared/repositories';
import { Logger } from '../shared/logger';
import { NotificationService, NotificationStateService } from '../shared/notification';

// Scraper
import { PriceMonitor } from '../scraper/monitoring';
import { ScraperFactory } from '../scraper/scrapers';

// Load environment variables
dotenv.config();

// Create file-based repositories (shops always from files per requirements)
const shopRepository: IShopRepository = new FileShopRepository(
  path.join(__dirname, '../config/shops')
);

async function main() {
  const startTime = Date.now();

  // Validate environment variables
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
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

  if (!mongodbUri) {
    console.error('ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  // Initialize logger
  const logger = new Logger(logLevel);

  // Initialize MongoDB connection and repositories
  let watchlistRepository: IWatchlistRepository;
  let notificationStateRepository: MongoNotificationStateRepository;
  let productResultRepository: MongoProductResultRepository;

  try {
    await connectDB(mongodbUri);
    watchlistRepository = new MongoWatchlistRepository();
    notificationStateRepository = new MongoNotificationStateRepository();
    productResultRepository = new MongoProductResultRepository();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    // Create services
    const notificationService = new NotificationService(telegramToken, telegramChatId, logger);
    const stateManager = new NotificationStateService(logger, notificationStateRepository);

    // Create monitor with new architecture
    const monitor = new PriceMonitor({
      scraperFactory: ScraperFactory,
      notificationService,
      stateManager,
      shopRepository,
      watchlistRepository,
      productResultRepository,
      logger,
    });

    await monitor.initialize();

    // Run single scan cycle
    console.log('Starting scan cycle...');
    await monitor.runFullScanCycle();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Scan completed in ${duration}s`);
  } catch (error) {
    console.error('Scan failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// Run the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
