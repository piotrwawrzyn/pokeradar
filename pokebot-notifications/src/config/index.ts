/**
 * Application configuration loaded from environment variables.
 */

export interface AppConfig {
  mongodbUri: string;
  telegramBotToken: string;
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

  return {
    mongodbUri,
    telegramBotToken,
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
