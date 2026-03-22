/**
 * Main entry point for the Pokemon Price Monitor.
 * Runs a single scan cycle and exits (designed for cron-based execution).
 * Multi-user: notifications fan out to all users based on their watch entries.
 * Notification delivery is handled by the pokeradar-notifications service.
 */

console.log('[BOOT] Process starting', {
  pid: process.pid,
  node: process.version,
  cwd: process.cwd(),
});

import * as dotenv from 'dotenv';

// Infrastructure
import { connectDB, disconnectDB } from '@pokeradar/shared';
import { NotificationStateModel } from '@pokeradar/shared';

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
import { getShopConfigDir, formatError, Logger } from '@pokeradar/shared';
import { NotificationStateService, MultiUserNotificationDispatcher } from '../shared/notification';

// Scraper
import { PriceMonitor } from '../scraper/monitoring';
import { ScraperFactory } from '../scraper/scrapers';

// Load environment variables
dotenv.config();

// Create file-based repositories (shops loaded from @pokeradar/shared config)
const shopRepository: IShopRepository = new FileShopRepository(getShopConfigDir());

async function main() {
  const startTime = Date.now();

  // Safety net: force exit if process hangs beyond this timeout (e.g. stuck HTTP request).
  // Generous default (30 min) — should never fire under normal conditions.
  const processTimeoutMs = Number(process.env.PROCESS_TIMEOUT_MS) || 30 * 60 * 1000;
  const processTimer = setTimeout(() => {
    console.error(`Process timeout reached (${processTimeoutMs}ms), forcing exit`);
    process.exit(1);
  }, processTimeoutMs);
  processTimer.unref();

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
    console.error('Failed to connect to MongoDB:', formatError(error));
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
      logger,
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
    console.error('Scan failed:', formatError(error));
    process.exit(1);
  } finally {
    clearTimeout(processTimer);
    await disconnectDB();
  }
}

// Run the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
