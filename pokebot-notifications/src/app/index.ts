/**
 * Main entry point for the Notification Delivery Service.
 * Long-running daemon that:
 * 1. Recovers pending notifications from previous runs
 * 2. Watches for new notifications via MongoDB change streams
 * 3. Delivers notifications via registered channels (Telegram, etc.)
 * 4. Handles retries with exponential backoff and rate limiting
 *
 * Requires MongoDB replica set for change streams.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../infrastructure/database';
import { TelegramChannel } from '../infrastructure/channels';
import { NotificationProcessor, ChangeStreamWatcher, RateLimiter } from '../services';
import { Logger } from '../shared/logger';
import { loadConfig } from '../config';

async function main() {
  console.log('[BOOT] Notification service starting', {
    pid: process.pid,
    node: process.version,
  });

  const config = loadConfig();
  const logger = new Logger('notifications.log', config.logLevel);

  // Connect to MongoDB
  await connectDB(config.mongodbUri);
  logger.info('Connected to MongoDB');

  // Initialize Telegram channel
  const telegramChannel = new TelegramChannel(config.telegramBotToken);

  // Create rate limiter for Telegram (25 msgs per 1.1s)
  const telegramRateLimiter = new RateLimiter(
    config.rateLimiting.telegramBatchSize,
    config.rateLimiting.telegramBatchIntervalMs
  );

  // Create notification processor
  const processor = new NotificationProcessor(config.retry, logger);
  processor.registerChannel(telegramChannel, telegramRateLimiter);

  // Recover pending notifications from before this run
  const recoveredCount = await processor.recoverPending();
  if (recoveredCount > 0) {
    logger.info('Recovered pending notifications from previous run', { count: recoveredCount });
  }

  // Start change stream watcher
  const watcher = new ChangeStreamWatcher(logger);
  watcher.start((doc) => processor.enqueue(doc));

  logger.info('Notification service is running');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);

    await watcher.stop();
    await processor.drain();
    await disconnectDB();

    logger.info('Notification service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
