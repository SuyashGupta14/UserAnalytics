import React from 'react';
import { Activity, RefreshCw, ExternalLink, BarChart3, Users, Flame, Play } from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'sessions' | 'heatmap' | 'demo';
  setActiveTab: (tab: 'overview' | 'sessions' | 'heatmap' | 'demo') => void;
  isLive: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isLive,
  isRefreshing,
  onRefresh,
  autoRefresh,
  setAutoRefresh,
}) => {
  return (
    <header className="app-header glass">
      <div className="header-left">
        <div className="brand">
          <div className="brand-icon">
            <Activity className="icon-pulse" size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-name">CausalFunnel</span>
            <span className="brand-badge">Analytics</span>
          </div>
        </div>

        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={16} />
            <span>Overview</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <Users size={16} />
            <span>Sessions</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'heatmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('heatmap')}
          >
            <Flame size={16} />
            <span>Heatmap & Click Map</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'demo' ? 'active' : ''}`}
            onClick={() => setActiveTab('demo')}
          >
            <Play size={16} />
            <span>Live Demo Store</span>
          </button>
        </nav>
      </div>

      <div className="header-right">
        <div className="status-indicator" title={isLive ? 'Backend connected' : 'Connecting to backend...'}>
          <span className={`status-dot ${isLive ? 'online' : 'offline'}`} />
          <span className="status-label">{isLive ? 'Live Engine' : 'Reconnecting'}</span>
        </div>

        <label className="auto-refresh-toggle" title="Toggle automatic data polling every 10 seconds">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          <span className="toggle-text">Auto 10s</span>
        </label>

        <button
          className="btn-icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
        </button>

        <a
          href="/demo/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-demo-link"
        >
          <span>Open Demo Store</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </header>
  );
};
