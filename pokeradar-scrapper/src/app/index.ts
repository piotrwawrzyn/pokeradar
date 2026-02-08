/**
 * Main entry point for the Pokemon Price Monitor.
 * Runs a single scan cycle and exits (designed for cron-based execution).
 * Multi-user: notifications fan out to all users based on their watch entries.
 * Notification delivery is handled by the pokeradar-notifications service.
 */

console.log('[BOOT] Process starting', { pid: process.pid, node: process.version, cwd: process.cwd() });

import * as dotenv from 'dotenv';
import * as path from 'path';

// Infrastructure
import { connectDB, disconnectDB } from '../infrastructure/database';
import { NotificationStateModel } from '../infrastructure/database/models';

// Shared
import {
  FileShopRepository,
  MongoWatchlistRepository,
  MongoNotificationStateRepository,
  MongoProductResultRepository,
  MongoUserRepository,
  MongoUserWatchEntryRepository,
  MongoNotificationRepository,
  IShopRepository,
  IWatchlistRepository,
} from '../shared/repositories';
import { Logger } from '../shared/logger';
import { NotificationStateService, MultiUserNotificationDispatcher } from '../shared/notification';

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
  const logLevel = (process.env.LOG_LEVEL as 'info' | 'debug') || 'info';
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    console.error('ERROR: MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  // Initialize logger
  const logger = new Logger('app.log', logLevel);

  // Initialize MongoDB connection and repositories
  let watchlistRepository: IWatchlistRepository;
  let notificationStateRepository: MongoNotificationStateRepository;
  let productResultRepository: MongoProductResultRepository;
  let userRepository: MongoUserRepository;
  let userWatchEntryRepository: MongoUserWatchEntryRepository;
  let notificationRepository: MongoNotificationRepository;

  try {
    await connectDB(mongodbUri);

    // Clean up legacy notification states that lack userId (migration from single-user)
    const deleted = await NotificationStateModel.deleteMany({ userId: { $exists: false } });
    if (deleted.deletedCount > 0) {
      console.log(`Cleaned up ${deleted.deletedCount} legacy notification states`);
    }

    watchlistRepository = new MongoWatchlistRepository();
    notificationStateRepository = new MongoNotificationStateRepository();
    productResultRepository = new MongoProductResultRepository();
    userRepository = new MongoUserRepository();
    userWatchEntryRepository = new MongoUserWatchEntryRepository();
    notificationRepository = new MongoNotificationRepository();
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    // Create services
    const stateManager = new NotificationStateService(logger, notificationStateRepository);

    // Create multi-user dispatcher (writes notification docs instead of sending Telegram)
    const dispatcher = new MultiUserNotificationDispatcher(
      stateManager,
      userWatchEntryRepository,
      userRepository,
      notificationRepository,
      logger
    );

    // Create monitor with multi-user architecture
    const monitor = new PriceMonitor({
      scraperFactory: ScraperFactory,
      dispatcher,
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
