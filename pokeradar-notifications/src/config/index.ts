/**
 * Application configuration loaded from environment variables.
 */

export interface AppConfig {
  mongodbUri: string;
  telegramBotToken: string;
  appUrl: string;
  logLevel: 'info' | 'debug';
  retry: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
  rateLimiting: {
    telegramBatchSize: number;
    telegramBatchIntervalMs: number;
  };
}

export function loadConfig(): AppConfig {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error('MONGODB_URI is not set in environment');
  }

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment');
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error('APP_URL is not set in environment');
  }

  return {
    mongodbUri,
    telegramBotToken,
    appUrl,
    logLevel: (process.env.LOG_LEVEL as 'info' | 'debug') || 'info',
    retry: {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 300_000,
    },
    rateLimiting: {
      telegramBatchSize: 25,
      telegramBatchIntervalMs: 1100,
    },
  };
}
