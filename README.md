# CausalFunnel User Analytics Platform

> A production-ready full-stack application that tracks user interactions on webpages and visualizes them in a real-time analytics dashboard with session explorer and canvas heatmap.

---

## 🌟 Key Features

1. **Client-Side Event Tracking Script (`tracker.js`)**
   - Zero external dependencies (<3KB compressed).
   - Tracks `page_view` and `click` interactions automatically.
   - Captures high-precision $x, y$ coordinates, viewport dimensions ($W \times H$), total document bounds, and target DOM metadata (`<button>`, `id`, `class`, text).
   - Session lifecycle: 30-minute sliding window stored in `localStorage` with fallback to `cookie`.
   - Single-Page Application (SPA) route change interception (`pushState`, `replaceState`, `popstate`).
   - Non-blocking batch delivery (10 events or 1.5s interval) and guaranteed page-unload flushing via `navigator.sendBeacon`.
   - Privacy-first: automatic sanitization and exclusion of sensitive form inputs (passwords, payment fields).

2. **Real-Time Analytics Dashboard**
   - **KPI Overview Cards**: Total Sessions, Page Views, Clicks, Avg Session Duration, and Total Telemetry Events.
   - **Session Explorer**: Paginated session listing, search by Session ID, multi-criteria sorting (Most Recent, Longest Duration, Most Clicks, Total Events).
   - **Chronological Timeline Stream**: Detailed drawer reconstructing the exact user journey with relative offset timestamps (`+00:14`, `+01:23`), click coordinates, and target element inspection pills.
   - **Interactive Canvas Heatmap & Click Map**:
     - Dual-mode renderer: **Thermal Density Heatmap** (radial gaussian gradients colorized with thermal palette) & **Scatter Dot Map** (pulsing glowing coordinates).
     - Hover inspection tooltip displaying exact $(x, y)$ coordinates and clicked element tags.
     - Controls for radius (15px-60px), intensity (20%-100%), and page selection.
   - **In-App Simulator**: Instant telemetry event emitter and copy-paste embed code snippet.

3. **Interactive E-Commerce Demo Store**
   - 4 realistic demo pages (`/demo/index.html`, `/demo/product.html`, `/demo/pricing.html`, `/demo/contact.html`) instrumented with `tracker.js`.

4. **Production-Ready Seed Data**
   - Generates 150 realistic sessions with gaussian hotspot click clusters across key call-to-actions, navigation links, and product cards.

---

## 🏗 Architecture

```
┌─────────────────────────────────┐
│       Webpage / Client          │
│   (demo/ or any external site)  │
└────────────────┬────────────────┘
                 │
                 │ 1. Event Tracking (page_view, click with x,y)
                 │    Buffered & Delivered via fetch() / sendBeacon()
                 ▼
┌─────────────────────────────────┐
│        Node.js Backend          │
│     (Express 5 + TypeScript)    │
│  - Zod Runtime Validation       │
│  - URL Normalization            │
│  - Rate Limiting & Helmet       │
└────────────────┬────────────────┘
                 │
                 │ 2. Ingestion & Aggregation
                 ▼
┌─────────────────────────────────┐
│      MongoDB Atlas Cluster      │
│  - Compound Indexed Events      │
│  - High-Speed Aggregations      │
└────────────────┬────────────────┘
                 │
                 │ 3. Analytics Query APIs (/api/*)
                 ▼
┌─────────────────────────────────┐
│    React Analytics Dashboard    │
│  - KPI Cards & Session Timeline │
│  - Canvas Heatmap Dual-Mode     │
└─────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Tracking Script** | Vanilla JavaScript (IIFE, zero dependencies, sendBeacon) |
| **Backend API** | Node.js, Express 5, TypeScript, Mongoose, Zod, Helmet, Pino |
| **Database** | MongoDB Atlas (Compound indexes: `session_id + timestamp`, `page_url + type + timestamp`) |
| **Frontend Dashboard** | React 19, Vite, TypeScript, Vanilla CSS Design System, Lucide Icons, HTML5 Canvas |
| **Testing** | Vitest, Supertest, mongodb-memory-server |

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 20+
- MongoDB Atlas connection string (or local MongoDB)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/SuyashGupta14/UserAnalytics.git
cd UserAnalytics

# Install dependencies for both server and dashboard
npm run install:all
```

### 2. Environment Setup

Create `server/.env`:
```env
PORT=4000
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development
```

### 3. Build & Seed Data

```bash
# Build frontend dashboard bundle and backend TypeScript
npm run build

# Seed database with 150 realistic user sessions & click hotspots
npm run seed
```

### 4. Run the Application

```bash
npm start
```

Now open:
- **Analytics Dashboard**: [http://localhost:4000/](http://localhost:4000/)
- **Demo Web Store**: [http://localhost:4000/demo/](http://localhost:4000/demo/)
- **Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔌 Embedding the Tracker on Any Site

Drop this single tag into the `<head>` or before `</body>` of any website:

```html
<script
  src="http://localhost:4000/tracker.js"
  data-endpoint="http://localhost:4000/api/events"
  async>
</script>
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/events` | Ingest single or batched events (up to 50). Validates with Zod schema. |
| `GET` | `/api/stats` | Aggregated KPIs (total sessions, events, clicks, views, avg duration). |
| `GET` | `/api/sessions` | Paginated sessions list with duration, view counts, and click counts. |
| `GET` | `/api/sessions/:id/events` | Chronological event stream for a specific session. |
| `GET` | `/api/heatmap?url=<url>` | Click coordinate points $(x, y)$, dimensions, and target metadata. |
| `GET` | `/api/heatmap/pages` | List distinct pages with click and view aggregations. |
| `GET` | `/api/health` | System uptime and MongoDB database status. |

---

## 🧪 Running Automated Tests

```bash
npm test
```
Runs 9 comprehensive integration tests covering event validation, URL normalization, batch ingestion, session aggregations, and beacon delivery.
