import React, { useState } from 'react';
import { Search, ArrowUpDown, ChevronRight, Copy, Check, Clock, Eye, MousePointerClick } from 'lucide-react';
import type { SessionSummary } from '../api';

interface SessionListProps {
  sessions: SessionSummary[];
  loading: boolean;
  onSelectSession: (sessionId: string) => void;
  selectedSessionId?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: string) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  loading,
  onSelectSession,
  selectedSessionId,
  currentPage,
  totalPages,
  onPageChange,
  sortField,
  sortOrder: _sortOrder,
  onSortChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
  };

  const filteredSessions = sessions.filter((s) =>
    s.session_id.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="section-container glass">
      <div className="section-header">
        <div className="section-title-wrap">
          <h2 className="section-title">Tracked User Sessions</h2>
          <span className="section-counter-badge">{sessions.length} sessions loaded</span>
        </div>

        <div className="section-controls">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Filter by session ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="sort-control">
            <ArrowUpDown size={15} />
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value)}
              className="sort-select"
            >
              <option value="last_seen">Sort: Most Recent</option>
              <option value="duration_seconds">Sort: Duration</option>
              <option value="event_count">Sort: Total Events</option>
              <option value="clicks">Sort: Most Clicks</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>First Interaction</th>
              <th>Last Seen</th>
              <th>Active Duration</th>
              <th>Page Views</th>
              <th>Clicks</th>
              <th>Total Events</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  <div className="loading-spinner-wrap">
                    <div className="spinner" />
                    <span>Loading session telemetry...</span>
                  </div>
                </td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  <div className="empty-state">
                    <p className="empty-title">No sessions found</p>
                    <p className="empty-desc">
                      {searchTerm
                        ? 'No session matched your search filter.'
                        : 'No tracked sessions yet. Open the demo store or click "Live Demo Store" to generate interaction events.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSessions.map((s) => {
                const isSelected = s.session_id === selectedSessionId;
                return (
                  <tr
                    key={s.session_id}
                    className={`table-row-clickable ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectSession(s.session_id)}
                  >
                    <td>
                      <div className="session-id-cell">
                        <span className="mono session-id-text" title={s.session_id}>
                          {s.session_id.length > 18 ? s.session_id.slice(0, 18) + '...' : s.session_id}
                        </span>
                        <button
                          className="btn-copy-id"
                          onClick={(e) => handleCopy(e, s.session_id)}
                          title="Copy session ID"
                        >
                          {copiedId === s.session_id ? (
                            <Check size={13} className="text-emerald" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="text-muted">{formatTime(s.first_seen)}</td>
                    <td className="text-muted">{formatTime(s.last_seen)}</td>
                    <td>
                      <span className="duration-badge">
                        <Clock size={12} />
                        {formatDuration(s.duration_seconds)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-cyan">
                        <Eye size={12} />
                        {s.page_views || 0}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-amber">
                        <MousePointerClick size={12} />
                        {s.clicks || 0}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-indigo">
                        {s.event_count || 0}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn-table-action">
                        <span>Inspect</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            className="btn-page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
