/**
 * API client for CausalFunnel Analytics Dashboard
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface StatsData {
  total_sessions: number;
  total_events: number;
  total_page_views: number;
  total_clicks: number;
  avg_duration_seconds: number;
  unique_pages: number;
}

export interface SessionSummary {
  session_id: string;
  first_seen: string;
  last_seen: string;
  duration_seconds: number;
  event_count: number;
  page_views: number;
  clicks: number;
  landing_page?: string;
}

export interface SessionsResponse {
  sessions: SessionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EventDetail {
  _id: string;
  session_id: string;
  type: 'page_view' | 'click';
  page_url: string;
  page_title?: string;
  timestamp: string;
  x?: number;
  y?: number;
  viewport_w?: number;
  viewport_h?: number;
  page_w?: number;
  page_h?: number;
  referrer?: string;
  target?: {
    tag?: string;
    id?: string;
    classes?: string;
    text?: string;
  };
}

export interface SessionEventsResponse {
  session_id: string;
  summary: {
    first_seen: string;
    last_seen: string;
    duration_seconds: number;
    event_count: number;
    page_views: number;
    clicks: number;
  };
  events: EventDetail[];
}

export interface HeatmapPoint {
  x: number;
  y: number;
  viewport_w?: number;
  viewport_h?: number;
  page_w?: number;
  page_h?: number;
  target?: {
    tag?: string;
    id?: string;
    classes?: string;
    text?: string;
  };
}

export interface HeatmapData {
  page_url: string;
  total_clicks: number | string;
  page_w: number;
  page_h: number;
  truncated: boolean;
  points: HeatmapPoint[];
}

export interface HeatmapPageItem {
  page_url: string;
  click_count: number;
  view_count: number;
  last_event: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<StatsData> {
  const res = await fetch(`${API_BASE}/api/stats`);
  return handleResponse<StatsData>(res);
}

export async function fetchSessions(params: {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
} = {}): Promise<SessionsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);

  const res = await fetch(`${API_BASE}/api/sessions?${query.toString()}`);
  const json: any = await handleResponse<any>(res);
  const rawList = json.sessions || json.data || [];
  const sessions = rawList.map((s: any) => ({
    session_id: s.session_id || s._id,
    first_seen: s.first_seen,
    last_seen: s.last_seen,
    duration_seconds: s.duration_seconds ?? Math.round((s.duration_ms || 0) / 1000),
    event_count: s.event_count || 0,
    page_views: s.page_views ?? s.page_view_count ?? 0,
    clicks: s.clicks ?? s.click_count ?? 0,
    landing_page: s.landing_page || s.entry_page,
  }));

  return {
    sessions,
    pagination: {
      page: json.pagination?.page || 1,
      limit: json.pagination?.limit || 20,
      total: json.pagination?.total || 0,
      totalPages: json.pagination?.totalPages || json.pagination?.total_pages || 1,
    },
  };
}

export async function fetchSessionEvents(sessionId: string): Promise<SessionEventsResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/events`);
  return handleResponse<SessionEventsResponse>(res);
}

export async function fetchHeatmapPages(): Promise<HeatmapPageItem[]> {
  const res = await fetch(`${API_BASE}/api/heatmap/pages`);
  return handleResponse<HeatmapPageItem[]>(res);
}

export async function fetchHeatmap(pageUrl: string): Promise<HeatmapData> {
  const res = await fetch(`${API_BASE}/api/heatmap?url=${encodeURIComponent(pageUrl)}`);
  return handleResponse<HeatmapData>(res);
}

export async function fetchHealth(): Promise<{ status: string; db: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleResponse<{ status: string; db: string }>(res);
}

export async function sendTestEvent(event: Partial<EventDetail>): Promise<any> {
  const res = await fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return handleResponse(res);
}
