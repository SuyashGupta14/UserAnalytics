import { Router, Request, Response } from 'express';
import { Event } from '../models/Event.js';

const router = Router();

/**
 * GET /api/sessions
 * List sessions with event counts, paginated.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const q = (req.query.q as string) || '';

    const matchStage: any = {};
    if (q) {
      matchStage.session_id = { $regex: `^${q}`, $options: 'i' };
    }

    const pipeline: any[] = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$session_id',
          event_count: { $sum: 1 },
          page_view_count: {
            $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] },
          },
          click_count: {
            $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
          },
          first_seen: { $min: '$timestamp' },
          last_seen: { $max: '$timestamp' },
          entry_page: { $first: '$page_url' },
          last_page: { $last: '$page_url' },
        },
      },
      { $sort: { last_seen: -1 as const } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await Event.aggregate(pipeline);
    const total = result.total[0]?.count || 0;

    const data = result.data.map((s: any) => ({
      session_id: s._id,
      event_count: s.event_count,
      page_view_count: s.page_view_count,
      click_count: s.click_count,
      first_seen: s.first_seen,
      last_seen: s.last_seen,
      duration_ms: new Date(s.last_seen).getTime() - new Date(s.first_seen).getTime(),
      entry_page: s.entry_page,
      last_page: s.last_page,
    }));

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

/**
 * GET /api/sessions/:sessionId/events
 * All events for a session, sorted by timestamp ascending.
 */
router.get('/:sessionId/events', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const events = await Event.find({ session_id: sessionId })
      .sort({ timestamp: 1, _id: 1 })
      .lean();

    if (events.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    const pageUrls = [...new Set(events.map((e) => e.page_url))];
    const pageViews = events.filter((e) => e.type === 'page_view').length;
    const clicks = events.filter((e) => e.type === 'click').length;
    const firstSeen = events[0].timestamp;
    const lastSeen = events[events.length - 1].timestamp;
    const durationSeconds = Math.max(0, Math.round((new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 1000));

    res.json({
      session_id: sessionId,
      events,
      summary: {
        event_count: events.length,
        page_views: pageViews,
        clicks: clicks,
        duration_seconds: durationSeconds,
        first_seen: firstSeen,
        last_seen: lastSeen,
        pages_visited: pageUrls,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
