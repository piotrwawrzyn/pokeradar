import * as dotenv from 'dotenv';
import { PriceMonitor } from './services/PriceMonitor';
import { SummaryService } from './services/HourlySummary';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Pokemon Price Monitor.
 */
async function main() {
  // Validate environment variables
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const intervalMs = parseInt(process.env.SCRAPE_INTERVAL_MS || '60000');
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

  console.log('🤖 Pokemon Price Monitor');
  console.log('========================');
  console.log(`Scan interval: ${intervalMs}ms (${intervalMs / 1000} seconds)`);
  console.log(`Log level: ${logLevel}`);
  console.log('');

  try {
    // Create and initialize monitor
    const monitor = new PriceMonitor(
      telegramToken,
      telegramChatId,
      intervalMs,
      logLevel
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
