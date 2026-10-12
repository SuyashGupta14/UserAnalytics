import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  session_id: string;
  type: 'page_view' | 'click';
  page_url: string;
  page_title: string;
  full_url: string;
  timestamp: Date;
  received_at: Date;
  // Click-only fields
  x?: number;
  y?: number;
  viewport_w?: number;
  viewport_h?: number;
  page_w?: number;
  page_h?: number;
  target?: {
    tag: string;
    id: string;
    classes: string;
    text: string;
  };
  // Context
  referrer: string;
  user_agent: string;
}

const eventSchema = new Schema<IEvent>(
  {
    session_id: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ['page_view', 'click'] },
    page_url: { type: String, required: true },
    page_title: { type: String, default: '' },
    full_url: { type: String, default: '' },
    timestamp: { type: Date, required: true },
    received_at: { type: Date, default: Date.now },
    // Click fields
    x: { type: Number },
    y: { type: Number },
    viewport_w: { type: Number },
    viewport_h: { type: Number },
    page_w: { type: Number },
    page_h: { type: Number },
    target: {
      type: new Schema(
        {
          tag: { type: String, default: '' },
          id: { type: String, default: '' },
          classes: { type: String, default: '' },
          text: { type: String, default: '' },
        },
        { _id: false }
      ),
    },
    // Context
    referrer: { type: String, default: '' },
    user_agent: { type: String, default: '' },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for query performance
eventSchema.index({ session_id: 1, timestamp: 1 });
eventSchema.index({ type: 1, page_url: 1 });
eventSchema.index({ timestamp: -1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
