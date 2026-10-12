import { z } from 'zod';

const targetSchema = z.object({
  tag: z.string().max(50).default(''),
  id: z.string().max(100).default(''),
  classes: z.string().max(200).default(''),
  text: z.string().max(50).default(''),
});

const baseEventSchema = z.object({
  session_id: z.string().min(1).max(64),
  page_url: z.string().url(),
  page_title: z.string().max(100).default(''),
  full_url: z.string().default(''),
  timestamp: z.union([
    z.string().datetime({ offset: true }),
    z.string().datetime(),
    z.number(),
  ]),
  referrer: z.string().default(''),
  user_agent: z.string().default(''),
});

const pageViewSchema = baseEventSchema.extend({
  type: z.literal('page_view'),
});

const clickSchema = baseEventSchema.extend({
  type: z.literal('click'),
  x: z.number().min(0),
  y: z.number().min(0),
  viewport_w: z.number().min(0).optional(),
  viewport_h: z.number().min(0).optional(),
  page_w: z.number().min(0).optional(),
  page_h: z.number().min(0).optional(),
  target: targetSchema.optional(),
});

export const eventSchema = z.discriminatedUnion('type', [pageViewSchema, clickSchema]);

export type EventInput = z.infer<typeof eventSchema>;

/**
 * Validate a single event or an array of events.
 * Always returns an array of validated events.
 */
export function validateEvents(body: unknown): EventInput[] {
  // Normalize: if it's a single object, wrap in array
  const items = Array.isArray(body) ? body : [body];

  if (items.length === 0) {
    throw new Error('Empty events array');
  }
  if (items.length > 50) {
    throw new Error('Batch size exceeds maximum of 50');
  }

  // Validate all — reject entire batch on any error
  return items.map((item, index) => {
    const result = eventSchema.safeParse(item);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Event at index ${index} is invalid: ${issues}`);
    }
    return result.data;
  });
}
