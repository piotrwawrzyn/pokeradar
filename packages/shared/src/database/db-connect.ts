import dns from 'node:dns';
import mongoose from 'mongoose';

// Use Google DNS for SRV lookups (some routers don't support SRV records)
dns.setServers(['8.8.8.8', '8.8.4.4']);

interface IDbLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: unknown): void;
}

const defaultLogger: IDbLogger = {
  info: (message: string) => console.log(`[DB] ${message}`),
  error: (message: string, meta?: unknown) => console.error(`[DB] ${message}`, meta),
};

let logger: IDbLogger = defaultLogger;

export function setDbLogger(newLogger: IDbLogger): void {
  logger = newLogger;
}

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

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    logger.info('MongoDB already disconnected.');
    return;
  }
  await mongoose.disconnect();
  logger.info('MongoDB disconnected.');
}

export function getConnectionState(): number {
  return mongoose.connection.readyState;
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
