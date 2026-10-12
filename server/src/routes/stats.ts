import { Router, Request, Response } from 'express';
import { Event } from '../models/Event.js';

const router = Router();

/**
 * GET /api/stats
 * Overview KPIs: total sessions, events, clicks, page views, avg events/session.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [overview] = await Event.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total_events: { $sum: 1 },
                total_clicks: {
                  $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
                },
                total_page_views: {
                  $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] },
                },
                sessions: { $addToSet: '$session_id' },
                unique_pages: { $addToSet: '$page_url' },
              },
            },
          ],
          sessionDurations: [
            {
              $group: {
                _id: '$session_id',
                start: { $min: '$timestamp' },
                end: { $max: '$timestamp' },
              },
            },
            {
              $project: {
                duration_ms: { $subtract: ['$end', '$start'] },
              },
            },
            {
              $group: {
                _id: null,
                avg_duration_ms: { $avg: '$duration_ms' },
              },
            },
          ],
          recent: [
            { $match: { timestamp: { $gte: oneDayAgo } } },
            { $group: { _id: '$session_id' } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const totals = overview.totals[0] || {
      total_events: 0,
      total_clicks: 0,
      total_page_views: 0,
      sessions: [],
      unique_pages: [],
    };
    const totalSessions = totals.sessions?.length || 0;
    const avgDurationMs = overview.sessionDurations[0]?.avg_duration_ms || 0;

    res.json({
      total_sessions: totalSessions,
      total_events: totals.total_events,
      total_clicks: totals.total_clicks,
      total_page_views: totals.total_page_views,
      unique_pages: totals.unique_pages?.length || 0,
      avg_duration_seconds: Math.round(avgDurationMs / 1000),
      avg_events_per_session: totalSessions > 0 ? Math.round(totals.total_events / totalSessions) : 0,
      sessions_last_24h: overview.recent[0]?.count || 0,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
