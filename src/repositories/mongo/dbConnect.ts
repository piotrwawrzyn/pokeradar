import mongoose from 'mongoose';
import { Logger } from '../../services/Logger';

const logger = new Logger();

export const connectDB = async (mongoUri: string): Promise<void> => {
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
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) {
    logger.info('MongoDB already disconnected.');
    return;
  }
  await mongoose.disconnect();
  logger.info('MongoDB disconnected.');
};
