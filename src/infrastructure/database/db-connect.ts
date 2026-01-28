/**
 * MongoDB connection management.
 */

import mongoose from 'mongoose';

/**
 * Logger interface for database connection logging.
 * Accepts any logger with info and error methods.
 */
interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: unknown): void;
}

/**
 * Simple console logger as default.
 */
const defaultLogger: ILogger = {
  info: (message: string) => console.log(`[DB] ${message}`),
  error: (message: string, meta?: unknown) => console.error(`[DB] ${message}`, meta),
};

let logger: ILogger = defaultLogger;

/**
 * Sets the logger instance for database operations.
 */
export function setDbLogger(newLogger: ILogger): void {
  logger = newLogger;
}

/**
 * Connects to MongoDB.
 * Reuses existing connection if already connected.
 */
export async function connectDB(mongoUri: string): Promise<void> {
  if (mongoose.connection.readyState >= 1) {
    logger.info('MongoDB already connected.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully.');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Disconnects from MongoDB.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    logger.info('MongoDB already disconnected.');
    return;
  }
  await mongoose.disconnect();
  logger.info('MongoDB disconnected.');
}

/**
 * Gets the current connection state.
 */
export function getConnectionState(): number {
  return mongoose.connection.readyState;
}

/**
 * Checks if database is connected.
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
