import { config } from './config.js';
import { connectDB } from './db.js';
import { createApp } from './app.js';
import pino from 'pino';

const logger = pino({ name: 'server' });

async function main() {
  await connectDB(config.mongoUri);

  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`Demo site: http://localhost:${config.port}/demo`);
    logger.info(`Health check: http://localhost:${config.port}/api/health`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
