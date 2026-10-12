# User Analytics Application

> A full-stack application that tracks user interactions on webpages and displays them in an analytics dashboard — built for the CausalFunnel Full Stack Engineer assessment.

<!-- TODO: Add live links and screenshots after deployment -->

## Features

- **Event Tracking Script** — Lightweight JS tracker that captures `page_view` and `click` events on any webpage
- **Sessions View** — List all sessions with event counts; click to see the ordered user journey
- **Heatmap View** — Select a page URL and visualize click positions as dots
- **Real-time Ingestion** — Events sent via `sendBeacon` for reliable, non-blocking delivery
- **Seed Data** — Realistic demo data with clustered hotspots for immediate visual impact

## Tech Stack

| Layer | Technology |
|-------|------------|
| Tracker | Vanilla JS (IIFE, bundled with esbuild) |
| Backend | Node.js, Express, TypeScript, Mongoose, Zod |
| Database | MongoDB |
| Dashboard | Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Testing | Vitest, Supertest, mongodb-memory-server |

## Architecture

```
┌──────────────┐    POST /api/events    ┌──────────────┐    ┌──────────────┐
│   Tracker    │ ───────────────────────>│   Express    │───>│   MongoDB    │
│  (any page)  │                        │   Backend    │<───│              │
└──────────────┘                        └──────┬───────┘    └──────────────┘
                                               │
                                        GET /api/*
                                               │
                                        ┌──────▼───────┐
                                        │   Next.js    │
                                        │  Dashboard   │
                                        └──────────────┘
```

## Data Model

Single `events` collection — sessions are derived via aggregation. Each event stores:
- `session_id`, `type`, `page_url`, `page_title`, `timestamp`, `received_at`
- Click events additionally store: `x`, `y`, `viewport_w/h`, `page_w/h`, `target`

**Trade-off:** No separate `sessions` collection keeps writes cheap and the schema simple. Session list cost grows with data; would add a sessions collection or materialized view at scale.

## Setup

### Prerequisites
- Node.js 20+
- MongoDB (local install or [Atlas free tier](https://www.mongodb.com/atlas))

### Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/user-analytics.git
cd user-analytics

# Server
cd server
cp .env.example .env    # Edit MONGODB_URI if needed
npm install
npm run build
npm run seed            # Load demo data
npm run dev

# In another terminal — Tracker
cd tracker
npm install
npm run build

# In another terminal — Dashboard
cd dashboard
cp .env.example .env
npm install
npm run dev
```

Then open:
- **Demo site:** http://localhost:4000/demo — click around to generate events
- **Dashboard:** http://localhost:3000 — view sessions, journeys, and heatmap

## Embedding the Tracker

Add to any webpage:
```html
<script src="https://YOUR-API/tracker.js" data-api="https://YOUR-API" async></script>
```

Options: `data-debug="true"` for console logging, `data-ignore-dnt` to track regardless of Do Not Track.

## API Reference

See [docs/API.md](docs/API.md) for full endpoint documentation with curl examples.

| Endpoint | Description |
|----------|-------------|
| `POST /api/events` | Receive and store events |
| `GET /api/sessions` | List sessions with event counts |
| `GET /api/sessions/:id/events` | Get all events for a session |
| `GET /api/heatmap?url=` | Get click data for a page |
| `GET /api/heatmap/pages` | List pages with click counts |
| `GET /api/stats` | Overview KPIs |

## Running Tests

```bash
# Backend tests (uses mongodb-memory-server, no real DB needed)
cd server && npm test

# Tracker tests
cd tracker && npm test
```

## Deployment

<!-- TODO: Add deployment details -->

- **Backend:** Render / Railway
- **Dashboard:** Vercel
- **Database:** MongoDB Atlas free tier

> Note: Free-tier hosting instances may sleep after inactivity. Expect a brief delay on the first request.

## Assumptions & Trade-offs

- "Node.js / Flask" interpreted as Node.js (Express)
- Sessions are derived by aggregation, not stored in their own collection
- Session = localStorage id with 30-minute inactivity rotation; cookie and memory fallbacks
- Page identity = origin + pathname; query strings and hashes are dropped
- Client timestamps are trusted but sanity-checked; `received_at` stored as second source of truth
- Heatmap uses document coordinates normalized by page size; may not align perfectly across very different breakpoints
- No authentication or multi-tenancy (stated as deliberate scope cut)
- Events can be lost if the browser dies before flush (best-effort via `sendBeacon`)
- Heatmap capped at 10,000 points per request

## What I Would Do Next

- Authentication and multi-tenancy (per-site API keys)
- SPA navigation detection (`pushState`/`popstate`)
- Heat mode and grid mode for heatmap visualization
- Real-time dashboard updates via WebSocket
- Sessions collection or materialized view for faster reads at scale
- Rate limiting per API key instead of per IP
- Event replay / session recording
- Export data as CSV
