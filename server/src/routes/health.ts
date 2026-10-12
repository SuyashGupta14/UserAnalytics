import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'up' : 'down';

  res.json({
    status: dbStatus === 'up' ? 'ok' : 'degraded',
    db: dbStatus,
    uptime: process.uptime(),
  });
});

export default router;
