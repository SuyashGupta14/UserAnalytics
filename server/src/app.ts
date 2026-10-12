import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import eventsRouter from './routes/events.js';
import sessionsRouter from './routes/sessions.js';
import heatmapRouter from './routes/heatmap.js';
import statsRouter from './routes/stats.js';
import healthRouter from './routes/health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Security
  app.use(helmet({
    contentSecurityPolicy: false, // Allow demo pages and tracker to load
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — allow all origins for the events endpoint (tracker runs on any site)
  app.use(cors());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // Body parsing — JSON and text/plain (sendBeacon uses text/plain)
  app.use(express.json({ limit: '100kb' }));
  app.use(express.text({ limit: '100kb', type: 'text/plain' }));

  // Middleware: parse text/plain bodies as JSON for sendBeacon
  app.use((req, _res, next) => {
    if (typeof req.body === 'string' && req.headers['content-type']?.includes('text/plain')) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Leave as-is; route handler will handle validation error
      }
    }
    next();
  });

  // API routes
  app.use('/api/events', eventsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/heatmap', heatmapRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/health', healthRouter);

  // Serve tracker script
  const trackerFile = path.resolve(__dirname, '../../tracker/tracker.js');
  app.get('/tracker.js', (_req, res) => {
    res.type('application/javascript').sendFile(trackerFile);
  });

  // Serve demo site
  const demoPath = path.resolve(__dirname, '../../demo');
  app.use('/demo', express.static(demoPath));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  return app;
}
