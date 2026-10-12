import { Router, Request, Response } from 'express';
import { Event } from '../models/Event.js';
import { validateEvents } from '../validation/eventSchema.js';
import { normalizeUrl } from '../utils/normalizeUrl.js';

const router = Router();

/**
 * POST /api/events
 * Accept one event or an array of events (max 50).
 * Reject entire batch on any validation error.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = validateEvents(req.body);

    const docs = validated.map((evt) => ({
      ...evt,
      page_url: normalizeUrl(evt.page_url),
      timestamp: new Date(evt.timestamp),
      received_at: new Date(),
    }));

    await Event.insertMany(docs);

    res.status(201).json({ accepted: docs.length });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message || 'Invalid event data',
      },
    });
  }
});

export default router;
