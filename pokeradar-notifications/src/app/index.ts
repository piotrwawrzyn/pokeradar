/**
 * Main entry point for the Notification & Bot Service.
 * Long-running daemon that:
 * 1. Starts bot platforms (Telegram, etc.) for interactive commands
 * 2. Recovers pending notifications from previous runs
 * 3. Watches for new notifications via MongoDB change streams
 * 4. Delivers notifications via platform channels with retries and rate limiting
 *
 * Requires MongoDB replica set for change streams.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '@pokeradar/shared';
import { TelegramBotPlatform, DiscordBotPlatform, IBotPlatform } from '../platforms';
import { NotificationProcessor, ChangeStreamWatcher, RateLimiter } from '../notifications';
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

  // Initialize bot platforms
  const platforms: IBotPlatform[] = [
    new TelegramBotPlatform(config.telegramBotToken, config.appUrl, logger),
    new DiscordBotPlatform(config.discordBotToken, config.appUrl, logger),
  ];

  // Start all platforms (enables command polling / slash command registration)
  for (const platform of platforms) {
    await platform.start();
    logger.info(`Platform started: ${platform.name}`);
  }

  // Create notification processor
  const processor = new NotificationProcessor(config.retry, logger);

  // Register each platform's notification channel with its own rate limiter
  const rateLimiterConfigs: Record<string, { size: number; intervalMs: number }> = {
    telegram: {
      size: config.rateLimiting.telegramBatchSize,
      intervalMs: config.rateLimiting.telegramBatchIntervalMs,
    },
    discord: {
      size: config.rateLimiting.discordBatchSize,
      intervalMs: config.rateLimiting.discordBatchIntervalMs,
    },
  };

  for (const platform of platforms) {
    const channel = platform.asNotificationChannel();
    const rlConfig = rateLimiterConfigs[platform.name] ?? { size: 10, intervalMs: 1000 };
    const rateLimiter = new RateLimiter(rlConfig.size, rlConfig.intervalMs);
    processor.registerChannel(channel, rateLimiter);
  }

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

    for (const platform of platforms) {
      await platform.stop();
    }

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
