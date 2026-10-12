import { Event } from '../models/Event.js';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { normalizeUrl } from '../utils/normalizeUrl.js';

/**
 * Seed script: generates ~150 realistic sessions across 4 demo pages.
 * Clicks cluster around believable hotspots (nav, CTA, product cards).
 * Run with: npx tsx src/scripts/seed.ts [--reset]
 */

const PAGES = [
  { url: 'http://localhost:4000/demo/', title: 'Home — Demo Store' },
  { url: 'http://localhost:4000/demo/product.html', title: 'Product — Demo Store' },
  { url: 'http://localhost:4000/demo/pricing.html', title: 'Pricing — Demo Store' },
  { url: 'http://localhost:4000/demo/contact.html', title: 'Contact — Demo Store' },
];

// Hotspot zones: click clusters around nav, hero CTA, product cards, etc.
const HOTSPOTS: Record<string, { x: number; y: number; spread: number }[]> = {
  '/demo/': [
    { x: 200, y: 45, spread: 60 },   // Nav links
    { x: 500, y: 45, spread: 60 },   // Nav links
    { x: 720, y: 350, spread: 80 },  // Hero CTA button
    { x: 360, y: 620, spread: 100 }, // Feature card 1
    { x: 720, y: 620, spread: 100 }, // Feature card 2
    { x: 1080, y: 620, spread: 100 },// Feature card 3
  ],
  '/demo/product.html': [
    { x: 400, y: 300, spread: 120 }, // Product image
    { x: 900, y: 400, spread: 60 },  // Add to cart button
    { x: 900, y: 500, spread: 40 },  // Price area
    { x: 720, y: 800, spread: 150 }, // Reviews section
  ],
  '/demo/pricing.html': [
    { x: 360, y: 400, spread: 80 },  // Plan 1
    { x: 720, y: 400, spread: 80 },  // Plan 2 (popular)
    { x: 1080, y: 400, spread: 80 }, // Plan 3
    { x: 720, y: 550, spread: 60 },  // CTA button
  ],
  '/demo/contact.html': [
    { x: 720, y: 400, spread: 100 }, // Form area
    { x: 720, y: 600, spread: 50 },  // Submit button
  ],
};

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
  { w: 1366, h: 768 },
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
];

const TARGETS = [
  { tag: 'a', id: 'nav-home', classes: 'nav-link', text: 'Home' },
  { tag: 'a', id: 'nav-product', classes: 'nav-link', text: 'Product' },
  { tag: 'a', id: 'nav-pricing', classes: 'nav-link', text: 'Pricing' },
  { tag: 'button', id: 'hero-cta', classes: 'btn btn-primary', text: 'Get Started' },
  { tag: 'button', id: 'add-to-cart', classes: 'btn btn-success', text: 'Add to Cart' },
  { tag: 'div', id: 'feature-card', classes: 'card', text: 'Analytics Dashboard' },
  { tag: 'a', id: 'plan-select', classes: 'btn btn-outline', text: 'Choose Plan' },
  { tag: 'button', id: 'submit-form', classes: 'btn btn-primary', text: 'Send Message' },
];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gaussian(mean: number, spread: number): number {
  // Box-Muller transform for clustered clicks
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(mean + z * spread));
}

function randomId(): string {
  return 'seed_' + crypto.randomUUID();
}

async function seed() {
  const reset = process.argv.includes('--reset');

  console.log(`Connecting to ${config.mongoUri}...`);
  await mongoose.connect(config.mongoUri);

  if (reset) {
    console.log('Resetting: deleting all seeded events...');
    await Event.deleteMany({ session_id: /^seed_/ });
  }

  const existingCount = await Event.countDocuments({ session_id: /^seed_/ });
  if (existingCount > 0 && !reset) {
    console.log(`Found ${existingCount} existing seed events. Use --reset to replace them.`);
    await mongoose.disconnect();
    return;
  }

  const events: any[] = [];
  const sessionCount = 150;
  const now = Date.now();

  for (let s = 0; s < sessionCount; s++) {
    const sessionId = randomId();
    const viewport = VIEWPORTS[rand(0, VIEWPORTS.length - 1)];
    // Sessions spread across the last 7 days
    const sessionStart = now - rand(0, 7 * 24 * 60 * 60 * 1000);
    // Each session visits 1-4 pages
    const pageCount = rand(1, 4);
    const visitedPages = [...PAGES].sort(() => Math.random() - 0.5).slice(0, pageCount);

    let currentTime = sessionStart;

    for (const page of visitedPages) {
      // page_view event
      events.push({
        session_id: sessionId,
        type: 'page_view',
        page_url: normalizeUrl(page.url),
        page_title: page.title,
        full_url: page.url,
        timestamp: new Date(currentTime),
        received_at: new Date(currentTime + rand(50, 200)),
        referrer: s === 0 ? '' : 'https://google.com',
        user_agent: 'Mozilla/5.0 (seed data)',
      });

      currentTime += rand(500, 3000);

      // 2-8 clicks per page
      const clickCount = rand(2, 8);
      const pagePath = new URL(page.url).pathname;
      const spots = HOTSPOTS[pagePath] || HOTSPOTS['/demo/'];

      for (let c = 0; c < clickCount; c++) {
        const spot = spots[rand(0, spots.length - 1)];
        const target = TARGETS[rand(0, TARGETS.length - 1)];

        events.push({
          session_id: sessionId,
          type: 'click',
          page_url: normalizeUrl(page.url),
          page_title: page.title,
          full_url: page.url,
          timestamp: new Date(currentTime),
          received_at: new Date(currentTime + rand(50, 200)),
          x: gaussian(spot.x, spot.spread),
          y: gaussian(spot.y, spot.spread),
          viewport_w: viewport.w,
          viewport_h: viewport.h,
          page_w: 1440,
          page_h: rand(2000, 4000),
          target,
          referrer: '',
          user_agent: 'Mozilla/5.0 (seed data)',
        });

        currentTime += rand(800, 5000);
      }

      currentTime += rand(2000, 10000);
    }
  }

  console.log(`Inserting ${events.length} events across ${sessionCount} sessions...`);
  // Insert in batches of 500
  for (let i = 0; i < events.length; i += 500) {
    await Event.insertMany(events.slice(i, i + 500));
  }

  console.log('✅ Seed complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
