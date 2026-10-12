import React from 'react';
import { Users, Eye, MousePointerClick, Clock, Layers, TrendingUp } from 'lucide-react';
import type { StatsData } from '../api';

interface StatsCardsProps {
  stats: StatsData | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const clicksPerSession = stats && stats.total_sessions > 0
    ? (stats.total_clicks / stats.total_sessions).toFixed(1)
    : '0';

  const cards = [
    {
      title: 'Total Sessions',
      value: stats ? stats.total_sessions.toLocaleString() : '0',
      subtitle: `${stats?.unique_pages || 0} unique landing paths`,
      icon: Users,
      colorClass: 'card-indigo',
      glowClass: 'glow-indigo',
    },
    {
      title: 'Total Page Views',
      value: stats ? stats.total_page_views.toLocaleString() : '0',
      subtitle: 'Navigation & visit events',
      icon: Eye,
      colorClass: 'card-cyan',
      glowClass: 'glow-cyan',
    },
    {
      title: 'Total Clicks',
      value: stats ? stats.total_clicks.toLocaleString() : '0',
      subtitle: `${clicksPerSession} clicks / session avg`,
      icon: MousePointerClick,
      colorClass: 'card-amber',
      glowClass: 'glow-amber',
    },
    {
      title: 'Avg Session Duration',
      value: stats ? formatDuration(stats.avg_duration_seconds) : '0s',
      subtitle: 'User active engagement span',
      icon: Clock,
      colorClass: 'card-emerald',
      glowClass: 'glow-emerald',
    },
    {
      title: 'Total Telemetry Events',
      value: stats ? stats.total_events.toLocaleString() : '0',
      subtitle: 'All ingested analytics packets',
      icon: Layers,
      colorClass: 'card-rose',
      glowClass: 'glow-rose',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card, idx) => {
        const IconComponent = card.icon;
        return (
          <div key={idx} className={`stat-card glass ${card.glowClass}`}>
            <div className="stat-card-header">
              <span className="stat-card-title">{card.title}</span>
              <div className={`stat-card-icon-wrap ${card.colorClass}`}>
                <IconComponent size={20} />
              </div>
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value">
                {loading ? <span className="skeleton-line" /> : card.value}
              </span>
              <div className="stat-card-footer">
                <TrendingUp size={12} className="trend-icon" />
                <span className="stat-card-subtitle">{card.subtitle}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
