# User Analytics Application — Implementation Plan

Assignment: CausalFunnel Full Stack Engineer take-home. Build a small full-stack app that tracks page interactions and shows them in a dashboard.

This file is written to be handed to a coding agent (Claude Code or similar) as the single source of truth. Read it fully before writing any code.

---

## 0. How the agent should work

1. Work phase by phase (Section 7). Do not start a phase until the previous phase's tests pass.
2. After every phase: run the full test suite, then make one commit (or a small set of commits) using Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Push to GitHub.
3. Branching: `main` is always green. Use one short-lived branch per phase (`phase-1-backend-ingest`), open a PR, merge with squash. This also gives the reviewer a clean history to read.
4. Never commit secrets. Only `.env.example` is committed.
5. Prefer small, readable code over clever code. The reviewer will read it.
6. If a requirement is ambiguous, pick the simplest reasonable interpretation, and record it in the README under "Assumptions & trade-offs".
7. Every phase ends with a short note appended to `docs/PROGRESS.md` (what was done, what was decided, what is left).

---

## 1. Requirements checklist (from the assignment)

| # | Requirement | Where it is satisfied |
|---|---|---|
| R1 | JS tracking script embeddable in any page | `tracker/` built to `tracker.js` |
| R2 | Track `page_view` and `click` | tracker |
| R3 | Each event has `session_id` (cookie/localStorage), type, page URL, timestamp, click x/y for clicks | tracker + schema |
| R4 | Tracker sends events to backend API | `POST /api/events` |
| R5 | Simple demo webpage to test tracking | `demo/` |
| R6 | Node.js backend | `server/` (Express) |
| R7 | API: receive + store events | `POST /api/events` |
| R8 | API: sessions list with event counts | `GET /api/sessions` |
| R9 | API: all events for one session | `GET /api/sessions/:id/events` |
| R10 | API: click data for a page (heatmap) | `GET /api/heatmap?url=` |
| R11 | MongoDB, structured for querying | Mongoose schema + indexes |
| R12 | React/Next.js dashboard | `dashboard/` (Next.js) |
| R13 | Sessions view: list with total events, click a session to see ordered journey | dashboard |
| R14 | Heatmap view: select a page URL, show click positions visually | dashboard |
| R15 | Hosted (optional, preferred) | Vercel + Render/Railway + Atlas |
| R16 | Public GitHub repo | GitHub |
| R17 | README: setup, tech stack, assumptions/trade-offs | `README.md` |

Extras that add polish without adding risk: tests, seed script, Docker Compose, CI, KPI overview cards, dark mode, empty/loading/error states.

---

## 2. Tech stack (decisions made)

| Layer | Choice | Why |
|---|---|---|
| Tracker | Vanilla JS (ES2018), bundled with esbuild into one minified IIFE | Zero dependencies, tiny, works on any site |
| Backend | Node 20, Express 4, TypeScript, Mongoose 8, Zod, cors, helmet, express-rate-limit, pino | Familiar, easy to read, strong validation |
| Database | MongoDB (local install or Atlas free tier) | Required by the assignment |
| Dashboard | Next.js 14+ (App Router), TypeScript, Tailwind CSS, TanStack Query, lucide-react, Recharts (small sparklines only) | Required React/Next; fast to build a polished UI |
| Backend tests | Vitest + Supertest + `mongodb-memory-server` | Real Mongo behaviour, no external services |
| Tracker tests | Vitest + jsdom | Simulate DOM, clicks, storage |
| Dashboard tests | Manual verification | Faster iteration for a time-boxed assignment |

If TypeScript slows things down, plain JS is acceptable for `server/`. Keep the dashboard in TypeScript.

---

## 3. Repository layout

```
user-analytics/
├── README.md
├── IMPLEMENTATION_PLAN.md

├── .github/workflows/ci.yml
├── docs/
│   ├── PROGRESS.md
│   ├── API.md                    # endpoint reference with curl examples
│   └── screenshots/              # for the README
├── tracker/
│   ├── src/tracker.js
│   ├── test/tracker.test.js
│   └── package.json              # build script -> dist/tracker.js
├── server/
│   ├── src/
│   │   ├── index.ts              # boot
│   │   ├── app.ts                # express app (exported for tests)
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── models/Event.ts
│   │   ├── routes/{events,sessions,heatmap,stats,health}.ts
│   │   ├── validation/eventSchema.ts
│   │   ├── services/              # aggregation logic
│   │   └── utils/normalizeUrl.ts
│   ├── scripts/seed.ts
│   ├── test/
│   └── .env.example
├── demo/                         # static multi-page demo store site
│   ├── index.html
│   ├── product.html
│   ├── pricing.html
│   └── styles.css
└── dashboard/
    ├── src/app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Overview + sessions
    │   ├── sessions/[id]/page.tsx
    │   └── heatmap/page.tsx
    ├── src/components/
    ├── src/lib/{api.ts,format.ts}
    ├── tailwind.config.ts
    └── .env.example
```

Serve `tracker/dist/tracker.js` and the `demo/` folder from the backend (`/tracker.js`, `/demo/*`) so one deployed server hosts everything except the dashboard. That also makes the demo same-origin with the tracker, which makes the heatmap iframe overlay work.

---

## 4. Data model

### 4.1 `events` collection (single collection, one document per event)

```ts
{
  _id: ObjectId,
  session_id: string,        // uuid v4, required, indexed
  type: 'page_view' | 'click',
  page_url: string,          // normalized: origin + pathname (no query, no hash)
  page_title: string,        // document.title, truncated to 100 chars
  full_url: string,          // original href, for debugging
  timestamp: Date,           // client time of the event
  received_at: Date,         // server time, default now
  // click only
  x: number,                 // pageX (document coordinates)
  y: number,                 // pageY
  viewport_w: number,
  viewport_h: number,
  page_w: number,            // document scrollWidth at click time
  page_h: number,            // document scrollHeight at click time
  target: { tag, id, classes, text }, // text truncated to 50 chars, never from inputs
  // context (both types)
  referrer: string,
  user_agent: string
}
```

Why one collection and no `sessions` collection: sessions are derived with an aggregation (`$group` by `session_id`). That keeps writes cheap and the schema simple. Trade-off: session list cost grows with data; mitigated by indexes and pagination. Mention this in the README.

### 4.2 Indexes

- `{ session_id: 1, timestamp: 1 }` — session journey, session grouping
- `{ type: 1, page_url: 1 }` — heatmap query (partial index on `type: 'click'` is a good bonus)
- `{ timestamp: -1 }` — recency sorting and date filters

### 4.3 URL normalization rule

Strip hash and query string, lower-case host, remove trailing slash except root. Applied on the server (defence in depth) as well as the tracker. Document it as an assumption.

### 4.4 Coordinates for heatmap

Store document coordinates (`pageX/pageY`) plus the page and viewport size. The dashboard converts to percentages of `page_w` and `page_h` so clicks from different screen sizes overlay sensibly. This is the single most important detail for a heatmap that does not look broken.

---

## 5. API specification

Base path `/api`. JSON in, JSON out. All errors: `{ "error": { "code": string, "message": string, "details"?: any } }`.

### 5.1 `POST /api/events`
- Accepts a JSON array of events (1 to 50), or a single event object (wrapped into an array internally).
- Accepts `Content-Type: application/json` and `text/plain` (needed because `sendBeacon` with a plain-text body avoids a CORS preflight).
- Validate with Zod: `session_id` non-empty string ≤ 64, `type` enum, `page_url` valid URL, `timestamp` ISO string or epoch ms, click events require numeric non-negative `x`, `y`.
- Reject the entire batch with 400 on any validation error. On success respond `201 { accepted: n }`.
- Body limit 100 kb. Rate limit per IP (e.g. 300 req/min).
- CORS: allow all origins for this route (the tracker runs on any site). Dashboard routes restrict origin to `DASHBOARD_ORIGIN`.

### 5.2 `GET /api/sessions`
- Query: `page` (default 1), `limit` (default 20, max 100), optional `q` (session id prefix search), optional `from`/`to`.
- Response:
```json
{
  "data": [
    {
      "session_id": "…",
      "event_count": 12,
      "page_view_count": 3,
      "click_count": 9,
      "first_seen": "ISO",
      "last_seen": "ISO",
      "duration_ms": 84000,
      "entry_page": "https://…/",
      "last_page": "https://…/pricing"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 134, "total_pages": 7 }
}
```
- Sorted by `last_seen` desc. Implement with `$group` then `$sort`, `$facet` or a separate count.

### 5.3 `GET /api/sessions/:sessionId/events`
- Returns all events for that session sorted by `timestamp` asc (tie-break by `_id`).
- 404 if the session has no events.
- Response: `{ session_id, events: [...], summary: { event_count, first_seen, last_seen, pages_visited } }`.

### 5.4 `GET /api/heatmap?url=<page_url>`
- Normalizes `url` the same way, returns only `click` events for that page:
```json
{
  "page_url": "…",
  "total_clicks": 240,
  "page_w": 1440,
  "page_h": 2200,
  "points": [{ "x": 412, "y": 530, "viewport_w": 1440, "page_w": 1440, "page_h": 2200 }]
}
```
- Cap at 10,000 points (most recent), and say so in the response (`truncated: true`).
- 400 if `url` missing.

### 5.5 `GET /api/heatmap/pages`
- Distinct pages with click counts and last click time, for the page selector dropdown: `[{ page_url, click_count, view_count }]`.

### 5.6 `GET /api/stats`
- Overview KPIs: total sessions, total events, total clicks, total page views, avg events per session, sessions in last 24h.

### 5.7 `GET /api/health`
- `{ status: 'ok', db: 'up' }`. Used by the host's health check.

---

## 6. Tracker script spec

Usage on any page:
```html
<script src="https://YOUR-API/tracker.js" data-api="https://YOUR-API" async></script>
```

Behaviour:
- IIFE, no globals except an optional `window.__cfTracker` for tests/debug.
- Config read from the script tag's `data-api` (fallback: the script's own origin).
- **Session id:** `localStorage` key `cf_sid` with `{ id, last_active }`. If localStorage is unavailable (private mode, blocked), fall back to a first-party cookie `cf_sid`, then to an in-memory id. Generate with `crypto.randomUUID()` and a fallback. Rotate after 30 minutes of inactivity (document it).
- **page_view:** fire on `DOMContentLoaded`. SPA navigation detection (pushState/popstate) is a stretch goal — not needed since the demo site is static multi-page.
- **click:** one capture-phase listener on `document` (`click`, `{ capture: true }`). Record `pageX`, `pageY`, viewport and document dimensions, and a safe `target` descriptor. Never record text from `input`, `textarea`, `select`, or `[contenteditable]`. Truncate text to 50 chars.
- **Delivery:** queue events, flush every 2 s or when 10 are queued, and on `visibilitychange` (hidden) and `pagehide` using `navigator.sendBeacon(url, new Blob([json], {type:'text/plain'}))`. Fallback `fetch(..., { keepalive: true })`. On network failure, retry up to 3 times with backoff, then drop (log in debug mode only).
- Never throw into the host page. Wrap everything in try/catch.
- Respect `navigator.doNotTrack === '1'` unless `data-ignore-dnt` is set (document as a choice).
- Bundle size target: under 3 kB gzipped.
- Debug mode via `data-debug="true"` logs events to the console.

---

## 7. Phases (each ends in a commit, tests green)

### Phase 0 — Bootstrap
Tasks
- Create the repo and folder layout. Root `.gitignore` (node_modules, .env, dist, .next, coverage).
- Independent packages — each sub-project (`server/`, `tracker/`, `dashboard/`) has its own `package.json`.
- `.env.example` files with `MONGODB_URI=mongodb://localhost:27017/user-analytics`.
- README skeleton with the headings from Section 11.
Done when: repo structure exists, `.env.example` files are in place, git initialized.
Commit: `chore: bootstrap project structure and README skeleton`

### Phase 1 — Backend ingestion
Tasks
- Express app factory (`app.ts`) separate from `index.ts` for testability. Helmet, CORS, JSON + text parser, rate limit, pino logging, error middleware, 404 handler.
- Mongoose `Event` model with indexes.
- Zod schema and `POST /api/events` (single + batch).
- `normalizeUrl` util.
- `/api/health`.
Tests (3-4 key tests)
- accepts a valid `page_view` and a valid click with x/y; stored document has correct shape and `received_at`
- rejects invalid events (missing session_id, click without x/y, unknown type)
- URL normalization (strips hash, query, trailing slash)
Commit: `feat(server): event ingestion endpoint with validation and tests`

### Phase 2 — Backend read APIs and seed data
Tasks
- `GET /api/sessions` (aggregation, pagination, search), `GET /api/sessions/:id/events`, `GET /api/heatmap`, `GET /api/heatmap/pages`, `GET /api/stats`.
- `scripts/seed.ts`: generate ~150 realistic sessions across 4 demo pages. Clicks should cluster around believable hotspots (nav links, hero CTA, product buttons) with noise, across a few viewport sizes, so the heatmap looks meaningful in screenshots. Idempotent (`--reset` flag).
- `docs/API.md` with curl examples.
Tests (3-4 key tests)
- sessions: correct counts per session, correct sort, pagination works
- session events: ordered ascending, 404 for unknown session
- heatmap: returns only clicks for the requested page, 400 when `url` missing
Commit: `feat(server): sessions, heatmap and stats APIs with seed script`

### Phase 3 — Tracker and demo site
Tasks
- Implement the tracker per Section 6, bundle with esbuild to `tracker/dist/tracker.js`.
- Backend serves `/tracker.js` and `/demo`.
- Demo store site: 3 pages (home, product, pricing) with nav, hero CTA, product cards, buttons, a form (to verify no input text is captured). Make it look decent; it will be iframed in the heatmap.
Tests (2-3 key tests)
- creates a session id on first load and reuses it
- fires `page_view` on load; click produces x/y and viewport dims
- click inside an input does not leak its value
Manual check: open `/demo`, click around, confirm documents land in Mongo.
Commit: `feat(tracker): client tracking script and demo site`

### Phase 4 — Dashboard foundation and design system
Tasks
- `create-next-app` with TypeScript, Tailwind, App Router.
- Design tokens (Section 8), fonts (Inter + a display font), base components: `AppShell` (sidebar/topbar), `Card`, `StatCard`, `Badge`, `Button`, `DataTable`, `Skeleton`, `EmptyState`, `ErrorState`, `Pagination`.
- API client in `lib/api.ts` with typed responses, `NEXT_PUBLIC_API_URL` env var, TanStack Query provider.
- Dark mode via `class` strategy with a toggle (optional but cheap).
Tests: manual verification of components rendering correctly.
Commit: `feat(dashboard): app shell, design system and API client`

### Phase 5 — Sessions view and user journey
Tasks
- Overview page: KPI row (sessions, events, clicks, page views) with subtle count-up animation, then the sessions table.
- Sessions table: truncated session id (copy button), event count, split page views/clicks, duration, entry page, last seen as relative time, search box, pagination, row click navigates to journey. Loading skeletons, empty and error states.
- Journey page `/sessions/[id]`: header with session summary, then a vertical timeline of ordered events. Each event: icon (eye for page view, pointer for click), type badge, page path, time offset from session start (`+12s`), and for clicks the `(x, y)` plus the target element. Page changes shown as grouped step headers so the path through the site reads like a funnel. Optional right-hand mini-summary: pages visited in order.
- Optional: open the journey in a side drawer from the table instead of a new page (the route page remains for deep links).
Tests: manual verification — table renders sessions, clicking navigates to journey, events show in order.
Commit: `feat(dashboard): sessions table and user journey timeline`

### Phase 6 — Heatmap view
Tasks
- `/heatmap` page: page selector dropdown (from `/api/heatmap/pages`, shows click counts), total click count, truncation notice.
- Rendering: a container with click dots overlaid on a visual representation of the page.
  - **Dots mode** (primary): semi-transparent coloured dots positioned using percentage coordinates (`x / page_w`, `y / page_h`). Hover tooltip showing coordinates and target element.
  - Scale: convert each point to a fraction of `page_w`/`page_h`, then multiply by the rendered container size so it stays aligned on resize.
  - Stretch goal: Heat mode (canvas-based radial gradient overlay) and Grid mode (bucketed cells).
- Helper `toFractions` in `lib/heatmap.ts`.
Tests: manual verification — page selector loads pages, dots appear at correct positions, empty state works.
Commit: `feat(dashboard): click heatmap with dot overlay`

### Phase 7 — Polish, deploy and docs
Tasks
- Error/empty/loading states for all data views.
- Quick responsive check (ensure dashboard is usable on smaller screens).
- Take screenshots into `docs/screenshots/`.
- MongoDB Atlas free cluster; backend on Render/Railway; dashboard on Vercel.
- Run seed script against hosted DB so reviewers see data immediately.
- Verify the full loop on live URLs: open hosted `/demo`, click, see it in the hosted dashboard.
- Finalize `README.md` (Section 11) and `docs/API.md` with setup steps, live links, screenshots.
Commit: `chore: polish, deploy and documentation`

---

## 8. UI design direction ("CausalFunnel-like")

Research notes from causalfunnel.com: the brand is a clean, trustworthy B2B SaaS look. Copy is outcome-led and plain ("Always Know What's Happening in Your Funnel", "Stop Guessing. Start Converting."), with a stats band (accuracy, sessions, tests running, revenue impact) using counting numbers, rounded white cards on light backgrounds, before/after comparison blocks, and prominent pill CTA buttons. The only colour value I could confirm from the page is slate `#1E293B` for dark text/icons; the rest of the palette below is a **proposed** system in the same spirit. Before Phase 4, open the live site and eyedropper its primary brand colour and swap it into `--primary`.

### Tokens (Tailwind theme)
- Background: `#F8FAFC` (slate-50); surfaces `#FFFFFF`; borders `#E2E8F0`
- Text: primary `#1E293B`, secondary `#64748B`, muted `#94A3B8`
- Primary (proposed): indigo-blue `#4F46E5`, hover `#4338CA`, soft tint `#EEF2FF`
- Accent for gradients: `#06B6D4` (cyan) into primary for hero/KPI highlights
- Semantic: success `#16A34A`, warning `#F59E0B`, danger `#DC2626`
- Heatmap ramp: `#2563EB` to `#22C55E` to `#FACC15` to `#EF4444`
- Dark mode: bg `#0B1220`, surface `#111A2E`, border `#1E293B`, text `#E2E8F0`
- Radius: cards 16px, buttons and inputs 10px, badges full
- Shadow: very soft (`0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)`)
- Typography: Inter for UI; tabular numerals for counts and timestamps; page titles 24–28px semibold, tight tracking

### Layout and components
- Left sidebar (collapsible on mobile) with logo wordmark, nav: Overview, Sessions, Heatmap; topbar with a theme toggle and a "Live" pulse badge when the last event is under 2 minutes old.
- KPI stat cards with a tiny sparkline and count-up animation, echoing the site's stats band.
- Sessions table: zebra-free, generous row height (56px), hover highlight, monospace truncated ids, chip-style event counts (blue for views, amber for clicks).
- Journey timeline: vertical line with circular icon nodes, page-change step headers with the path as a "funnel step" pill, offsets in muted text. A compact horizontal "path" strip at the top: Home, Product, Pricing as connected pills.
- Heatmap: left control panel (page select, mode segmented control, intensity slider), large stage on the right with a soft border and checkerboard-free neutral backdrop; legend gradient bar.
- Micro-interactions: 150–200 ms transitions, skeleton loaders, animated route transitions kept subtle, `prefers-reduced-motion` respected.
- Copy: friendly and plain, e.g. empty state "No sessions yet. Open the demo site and click around, then come back."

---

## 9. Test strategy summary

| Layer | Tooling | Focus |
|---|---|---|
| Backend | Vitest + Supertest + mongodb-memory-server | 3-4 tests per phase: validation, endpoints, aggregation |
| Tracker | Vitest + jsdom | 2-3 tests: session logic, event capture, privacy |
| Dashboard | Manual verification | Verify visually during development |

Rules: backend tests must run offline (memory server). Keep tests focused on logic correctness, not coverage numbers. 3-4 meaningful tests per backend phase.

---

## 10. Security, privacy and performance notes

- Tracker endpoint is public by nature: validate hard, cap body size, rate limit, cap batch size, ignore unknown fields.
- Dashboard APIs are unauthenticated in this assignment. State this in the README as a deliberate scope cut, and mention what production would need (auth, per-site API keys, tenant isolation).
- No PII: no input values, truncated element text, IP is not stored (only used for rate limiting).
- Escape everything rendered in the dashboard (React does this by default; never use `dangerouslySetInnerHTML` for event data).
- Avoid unbounded queries: always paginate sessions; cap heatmap points.
- Index every query path listed in Section 4.2.

---

## 11. README outline (required by the assignment)

1. Title, one-line description, live links (dashboard, API, demo), screenshots
2. Features
3. Tech stack (table)
4. Architecture (small diagram: tracker, API, MongoDB, dashboard) and data model
5. Setup
   - Prerequisites (Node 20, MongoDB local or Atlas URI)
   - `git clone`, `cp .env.example .env` for each package
   - `npm install`, `npm run build:tracker`
   - `npm run dev:server`, `npm run seed`, `npm run dev:dashboard`
   - Open `http://localhost:4000/demo` to generate events
6. Embedding the tracker (snippet and `data-*` options)
7. API reference summary (link to `docs/API.md`)
8. Running tests
9. Deployment notes
10. **Assumptions and trade-offs** (see below)
11. What I would do next

### Assumptions and trade-offs to record
- "Node.js / Flask" interpreted as Node.js (Express).
- Sessions are derived by aggregation, not stored in their own collection (simplicity over read speed; would add a `sessions` collection or materialized view at scale).
- Session = localStorage id with 30-minute inactivity rotation; cookie and memory fallbacks.
- Page identity = origin + pathname; query strings and hashes are dropped (so `/product?id=1` and `/product?id=2` merge; configurable later).
- Client timestamps are trusted but sanity-checked; `received_at` is stored as a second source of truth.
- Heatmap uses document coordinates normalized by page size; very long or dynamic pages may not align perfectly across breakpoints.
- Heatmap iframe preview only works for pages that allow framing; otherwise a wireframe stage is shown.
- No authentication or multi-tenancy.
- Events can be lost if the browser dies before flush (best-effort delivery via `sendBeacon`).
- Heatmap capped at 10,000 points per request.

---

## 12. Definition of done (final QA checklist)

- [ ] Opening `/demo` and clicking creates `page_view` and `click` documents with all required fields
- [ ] Same browser keeps one `session_id` across pages; a new browser/incognito gets a new one
- [ ] Sessions list shows correct total events and updates after new activity
- [ ] Clicking a session shows events in correct chronological order
- [ ] Heatmap page selector lists tracked pages; points appear in the right places on the preview
- [ ] All tests pass locally and in CI
- [ ] Fresh clone follows the README and works without help
- [ ] No secrets in git history
- [ ] Live URLs work (or the README explains why not)
- [ ] Screenshots and live links in the README
- [ ] Repo is public

---

## 13. Kickoff prompt to give the agent

> Read `IMPLEMENTATION_PLAN.md` end to end. Execute it phase by phase starting at Phase 0. For each phase: implement the tasks, write the listed tests, run the full test suite, update `docs/PROGRESS.md`, commit with a Conventional Commit message on a phase branch, and open a PR to `main`. Stop after each phase and give me a 3-line summary plus anything you were unsure about before starting the next phase. Follow the API spec, data model, tracker spec and UI design direction exactly; where something is ambiguous, choose the simplest option and add it to the README's "Assumptions and trade-offs" section. Do not add features outside the plan without asking.

Tip: to save time, tell the agent it can run phases 0 to 3 without stopping if all tests are green, and only pause before the dashboard phases so you can review the UI direction.
