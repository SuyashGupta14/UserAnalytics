import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({ name: 'db' });

export async function connectDB(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error(err, 'Failed to connect to MongoDB');
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
