import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { Event } from '../src/models/Event.js';

let mongoServer: MongoMemoryServer;
let app: ReturnType<typeof createApp>;
let request: ReturnType<typeof supertest>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = createApp();
  request = supertest(app);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Event.deleteMany({});
});

// ─── Phase 1: Event Ingestion ────────────────────────────────────────────────

describe('POST /api/events', () => {
  it('accepts a valid page_view and a valid click; stored documents have correct shape', async () => {
    // Page view
    const pvRes = await request
      .post('/api/events')
      .send({
        session_id: 'test-session-1',
        type: 'page_view',
        page_url: 'https://example.com/home',
        page_title: 'Home Page',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    expect(pvRes.body.accepted).toBe(1);

    // Click
    const clickRes = await request
      .post('/api/events')
      .send({
        session_id: 'test-session-1',
        type: 'click',
        page_url: 'https://example.com/home',
        page_title: 'Home Page',
        timestamp: new Date().toISOString(),
        x: 100,
        y: 200,
        viewport_w: 1440,
        viewport_h: 900,
        page_w: 1440,
        page_h: 3000,
        target: { tag: 'button', id: 'cta', classes: 'btn primary', text: 'Buy Now' },
      })
      .expect(201);

    expect(clickRes.body.accepted).toBe(1);

    // Verify stored documents
    const docs = await Event.find({}).lean();
    expect(docs).toHaveLength(2);

    const pageView = docs.find((d) => d.type === 'page_view')!;
    expect(pageView.session_id).toBe('test-session-1');
    expect(pageView.page_url).toBe('https://example.com/home');
    expect(pageView.page_title).toBe('Home Page');
    expect(pageView.received_at).toBeInstanceOf(Date);

    const click = docs.find((d) => d.type === 'click')!;
    expect(click.x).toBe(100);
    expect(click.y).toBe(200);
    expect(click.target?.tag).toBe('button');
  });

  it('rejects invalid events: missing session_id, click without x/y, unknown type', async () => {
    // Missing session_id
    await request
      .post('/api/events')
      .send({
        type: 'page_view',
        page_url: 'https://example.com/',
        timestamp: new Date().toISOString(),
      })
      .expect(400);

    // Click without x/y
    await request
      .post('/api/events')
      .send({
        session_id: 'test',
        type: 'click',
        page_url: 'https://example.com/',
        timestamp: new Date().toISOString(),
      })
      .expect(400);

    // Unknown type
    await request
      .post('/api/events')
      .send({
        session_id: 'test',
        type: 'scroll',
        page_url: 'https://example.com/',
        timestamp: new Date().toISOString(),
      })
      .expect(400);

    // Nothing should have been stored
    const count = await Event.countDocuments();
    expect(count).toBe(0);
  });

  it('normalizes URLs: strips hash, query string, and trailing slash', async () => {
    await request
      .post('/api/events')
      .send({
        session_id: 'test',
        type: 'page_view',
        page_url: 'https://Example.COM/products/?ref=home#section',
        timestamp: new Date().toISOString(),
      })
      .expect(201);

    const doc = await Event.findOne({}).lean();
    expect(doc!.page_url).toBe('https://example.com/products');
  });

  it('accepts batch of events as array', async () => {
    const events = [
      {
        session_id: 'batch-1',
        type: 'page_view',
        page_url: 'https://example.com/a',
        timestamp: new Date().toISOString(),
      },
      {
        session_id: 'batch-1',
        type: 'page_view',
        page_url: 'https://example.com/b',
        timestamp: new Date().toISOString(),
      },
      {
        session_id: 'batch-1',
        type: 'click',
        page_url: 'https://example.com/a',
        timestamp: new Date().toISOString(),
        x: 50,
        y: 60,
      },
    ];

    const res = await request.post('/api/events').send(events).expect(201);
    expect(res.body.accepted).toBe(3);
  });
});

// ─── Phase 2: Read APIs ─────────────────────────────────────────────────────

describe('GET /api/sessions', () => {
  beforeEach(async () => {
    // Seed two sessions with different event counts
    const events = [
      { session_id: 'sess-a', type: 'page_view', page_url: 'https://example.com/', timestamp: new Date('2024-01-01T10:00:00Z'), received_at: new Date() },
      { session_id: 'sess-a', type: 'click', page_url: 'https://example.com/', timestamp: new Date('2024-01-01T10:01:00Z'), received_at: new Date(), x: 10, y: 20 },
      { session_id: 'sess-a', type: 'page_view', page_url: 'https://example.com/pricing', timestamp: new Date('2024-01-01T10:02:00Z'), received_at: new Date() },
      { session_id: 'sess-b', type: 'page_view', page_url: 'https://example.com/', timestamp: new Date('2024-01-02T10:00:00Z'), received_at: new Date() },
    ];
    await Event.insertMany(events);
  });

  it('returns correct counts per session, sorted by last_seen desc, with pagination', async () => {
    const res = await request.get('/api/sessions').expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);

    // sess-b is more recent, should be first
    expect(res.body.data[0].session_id).toBe('sess-b');
    expect(res.body.data[0].event_count).toBe(1);

    // sess-a has 3 events
    expect(res.body.data[1].session_id).toBe('sess-a');
    expect(res.body.data[1].event_count).toBe(3);
    expect(res.body.data[1].page_view_count).toBe(2);
    expect(res.body.data[1].click_count).toBe(1);
  });
});

describe('GET /api/sessions/:id/events', () => {
  beforeEach(async () => {
    await Event.insertMany([
      { session_id: 'sess-a', type: 'page_view', page_url: 'https://example.com/', timestamp: new Date('2024-01-01T10:00:00Z'), received_at: new Date() },
      { session_id: 'sess-a', type: 'click', page_url: 'https://example.com/', timestamp: new Date('2024-01-01T10:01:00Z'), received_at: new Date(), x: 10, y: 20 },
      { session_id: 'other', type: 'page_view', page_url: 'https://example.com/', timestamp: new Date('2024-01-01T10:00:00Z'), received_at: new Date() },
    ]);
  });

  it('returns events in ascending order; 404 for unknown session', async () => {
    const res = await request.get('/api/sessions/sess-a/events').expect(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0].type).toBe('page_view');
    expect(res.body.events[1].type).toBe('click');
    expect(res.body.summary.event_count).toBe(2);

    // 404 for unknown
    await request.get('/api/sessions/nonexistent/events').expect(404);
  });
});

describe('GET /api/heatmap', () => {
  beforeEach(async () => {
    await Event.insertMany([
      { session_id: 's1', type: 'click', page_url: 'https://example.com', timestamp: new Date(), received_at: new Date(), x: 100, y: 200, page_w: 1440, page_h: 3000 },
      { session_id: 's1', type: 'click', page_url: 'https://example.com', timestamp: new Date(), received_at: new Date(), x: 300, y: 400, page_w: 1440, page_h: 3000 },
      { session_id: 's1', type: 'page_view', page_url: 'https://example.com', timestamp: new Date(), received_at: new Date() },
      { session_id: 's1', type: 'click', page_url: 'https://example.com/other', timestamp: new Date(), received_at: new Date(), x: 50, y: 60, page_w: 1440, page_h: 2000 },
    ]);
  });

  it('returns only clicks for the requested page; 400 when url missing', async () => {
    const res = await request
      .get('/api/heatmap')
      .query({ url: 'https://example.com/' })
      .expect(200);

    expect(res.body.points).toHaveLength(2);
    expect(res.body.page_url).toBe('https://example.com');
    // All points should have x, y
    res.body.points.forEach((p: any) => {
      expect(p.x).toBeTypeOf('number');
      expect(p.y).toBeTypeOf('number');
    });

    // Missing url
    await request.get('/api/heatmap').expect(400);
  });
});

describe('GET /tracker.js and Beacon ingestion', () => {
  it('serves tracker.js with javascript content type', async () => {
    const res = await request.get('/tracker.js').expect(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.text).toContain('CausalTracker');
  });

  it('accepts text/plain payload (sendBeacon format)', async () => {
    const beaconPayload = JSON.stringify([
      {
        session_id: 'beacon-session',
        type: 'page_view',
        page_url: 'https://example.com/beacon',
        timestamp: new Date().toISOString(),
      },
    ]);

    await request
      .post('/api/events')
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(beaconPayload)
      .expect(201);

    const doc = await Event.findOne({ session_id: 'beacon-session' }).lean();
    expect(doc).toBeDefined();
    expect(doc?.page_url).toBe('https://example.com/beacon');
  });
});

