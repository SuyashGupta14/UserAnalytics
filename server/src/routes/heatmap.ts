import { Router, Request, Response } from 'express';
import { Event } from '../models/Event.js';
import { normalizeUrl } from '../utils/normalizeUrl.js';

const router = Router();

/**
 * GET /api/heatmap?url=<page_url>
 * Returns click events for the given page, capped at 10,000 most recent.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({
        error: { code: 'MISSING_URL', message: 'Query parameter "url" is required' },
      });
      return;
    }

    const normalizedUrl = normalizeUrl(url);
    const CAP = 10_000;

    const clicks = await Event.find({
      type: 'click',
      page_url: normalizedUrl,
    })
      .sort({ timestamp: -1 })
      .limit(CAP + 1)
      .select('x y viewport_w viewport_h page_w page_h target timestamp')
      .lean();

    const truncated = clicks.length > CAP;
    const points = clicks.slice(0, CAP).map((c) => ({
      x: c.x,
      y: c.y,
      viewport_w: c.viewport_w,
      viewport_h: c.viewport_h,
      page_w: c.page_w,
      page_h: c.page_h,
      target: c.target,
    }));

    // Derive common page dimensions from the most frequent values
    const pageW = points[0]?.page_w || 0;
    const pageH = points[0]?.page_h || 0;

    res.json({
      page_url: normalizedUrl,
      total_clicks: truncated ? `${CAP}+` : points.length,
      page_w: pageW,
      page_h: pageH,
      truncated,
      points,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

/**
 * GET /api/heatmap/pages
 * List distinct pages with click and view counts.
 */
router.get('/pages', async (req: Request, res: Response) => {
  try {
    const pages = await Event.aggregate([
      {
        $group: {
          _id: '$page_url',
          click_count: {
            $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
          },
          view_count: {
            $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] },
          },
          last_event: { $max: '$timestamp' },
        },
      },
      { $sort: { click_count: -1 as const } },
    ]);

    res.json(
      pages.map((p) => ({
        page_url: p._id,
        click_count: p.click_count,
        view_count: p.view_count,
        last_event: p.last_event,
      }))
    );
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

export default router;
