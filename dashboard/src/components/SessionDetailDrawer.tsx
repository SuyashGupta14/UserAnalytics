import React, { useEffect } from 'react';
import { X, Clock, Eye, MousePointerClick, Globe, Target, Layers, Copy, Check } from 'lucide-react';
import type { SessionEventsResponse } from '../api';

interface SessionDetailDrawerProps {
  sessionData: SessionEventsResponse | null;
  loading: boolean;
  onClose: () => void;
}

export const SessionDetailDrawer: React.FC<SessionDetailDrawerProps> = ({
  sessionData,
  loading,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sessionData && !loading) return null;

  const handleCopyId = () => {
    if (!sessionData) return;
    navigator.clipboard.writeText(sessionData.session_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatRelativeOffset = (eventIso: string, startIso: string) => {
    const eventTime = new Date(eventIso).getTime();
    const startTime = new Date(startIso).getTime();
    const diffSec = Math.max(0, Math.floor((eventTime - startTime) / 1000));
    const m = Math.floor(diffSec / 60).toString().padStart(2, '0');
    const s = (diffSec % 60).toString().padStart(2, '0');
    return `+${m}:${s}`;
  };

  const firstEventTime = sessionData?.events[0]?.timestamp || sessionData?.summary?.first_seen || '';

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-content glass" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-wrap">
            <span className="drawer-eyebrow">Session Stream Explorer</span>
            <div className="drawer-session-id-row">
              <span className="mono drawer-session-id">
                {sessionData ? sessionData.session_id : 'Loading session...'}
              </span>
              <button
                className="btn-copy-id"
                onClick={handleCopyId}
                title="Copy full session ID"
              >
                {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <button className="btn-close-drawer" onClick={onClose} title="Close drawer">
            <X size={20} />
          </button>
        </div>

        {sessionData && (
          <div className="drawer-summary-ribbon">
            <div className="ribbon-item">
              <Clock size={14} className="text-emerald" />
              <span>Duration: <strong>{formatDuration(sessionData.summary.duration_seconds)}</strong></span>
            </div>
            <div className="ribbon-item">
              <Eye size={14} className="text-cyan" />
              <span>Page Views: <strong>{sessionData.summary.page_views}</strong></span>
            </div>
            <div className="ribbon-item">
              <MousePointerClick size={14} className="text-amber" />
              <span>Clicks: <strong>{sessionData.summary.clicks}</strong></span>
            </div>
            <div className="ribbon-item">
              <Layers size={14} className="text-indigo" />
              <span>Total Events: <strong>{sessionData.summary.event_count}</strong></span>
            </div>
          </div>
        )}

        <div className="drawer-body">
          {loading ? (
            <div className="drawer-loading">
              <div className="spinner" />
              <span>Reconstructing chronological interaction events...</span>
            </div>
          ) : sessionData?.events.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No events recorded</p>
              <p className="empty-desc">This session has no recorded events.</p>
            </div>
          ) : (
            <div className="timeline-container">
              <div className="timeline-spine" />
              {sessionData?.events.map((evt, idx) => {
                const isClick = evt.type === 'click';
                const offset = formatRelativeOffset(evt.timestamp, firstEventTime);

                return (
                  <div key={evt._id || idx} className="timeline-node">
                    <div className={`timeline-dot ${isClick ? 'dot-amber' : 'dot-cyan'}`}>
                      {isClick ? <MousePointerClick size={12} /> : <Eye size={12} />}
                    </div>

                    <div className="timeline-card glass">
                      <div className="timeline-card-header">
                        <div className="timeline-badge-group">
                          <span className={`badge ${isClick ? 'badge-amber' : 'badge-cyan'}`}>
                            {isClick ? 'Click Event' : 'Page View'}
                          </span>
                          <span className="timeline-offset mono">{offset}</span>
                        </div>
                        <span className="timeline-time text-dim">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="timeline-card-body">
                        <div className="timeline-url-row">
                          <Globe size={14} className="text-dim" />
                          <span className="timeline-url mono">{evt.page_url}</span>
                        </div>

                        {evt.page_title && (
                          <div className="timeline-title-row">
                            <span className="timeline-page-title">{evt.page_title}</span>
                          </div>
                        )}

                        {isClick && (
                          <div className="click-details-box">
                            <div className="click-coord-row">
                              <Target size={14} className="text-amber" />
                              <span className="coord-text mono">
                                Coordinates: <strong>X: {evt.x}px, Y: {evt.y}px</strong>
                              </span>
                              {evt.viewport_w && evt.viewport_h && (
                                <span className="viewport-hint text-dim">
                                  (Viewport: {evt.viewport_w}×{evt.viewport_h})
                                </span>
                              )}
                            </div>

                            {evt.target && (
                              <div className="target-element-badge">
                                <span className="target-tag mono">&lt;{evt.target.tag || 'element'}&gt;</span>
                                {evt.target.id && (
                                  <span className="target-id mono">#{evt.target.id}</span>
                                )}
                                {evt.target.classes && (
                                  <span className="target-class mono">.{evt.target.classes.split(' ')[0]}</span>
                                )}
                                {evt.target.text && (
                                  <span className="target-text">
                                    "{evt.target.text}"
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
