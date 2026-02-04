/**
 * Main entry point for the Bot Service.
 * Long-running daemon that:
 * 1. Connects to MongoDB (for user lookup during /link)
 * 2. Starts registered bots (Telegram, etc.)
 * 3. Handles graceful shutdown
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '@pokeradar/shared';
import { TelegramBotService } from '../bots/telegram/telegram-bot';
import { Logger } from '../shared/logger';
import { loadConfig } from '../config';
import { IBot } from '../shared/bot.interface';

async function main() {
  console.log('[BOOT] Bot service starting', {
    pid: process.pid,
    node: process.version,
  });

  const config = loadConfig();
  const logger = new Logger('bot.log', config.logLevel);

  // Connect to MongoDB
  await connectDB(config.mongodbUri);
  logger.info('Connected to MongoDB');

  // Initialize bots
  const bots: IBot[] = [
    new TelegramBotService(config.telegramBotToken, config.appUrl, logger),
  ];

  // Start all bots
  for (const bot of bots) {
    await bot.start();
    logger.info(`Bot started: ${bot.name}`);
  }

  logger.info('Bot service is running');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);

    for (const bot of bots) {
      await bot.stop();
    }

    await disconnectDB();
    logger.info('Bot service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
