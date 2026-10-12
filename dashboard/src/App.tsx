import { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  fetchStats,
  fetchSessions,
  fetchSessionEvents,
  fetchHeatmapPages,
  fetchHeatmap,
  fetchHealth,
} from './api';
import type {
  StatsData,
  SessionSummary,
  SessionEventsResponse,
  HeatmapPageItem,
  HeatmapData,
} from './api';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { SessionList } from './components/SessionList';
import { SessionDetailDrawer } from './components/SessionDetailDrawer';
import { HeatmapViewer } from './components/HeatmapViewer';
import { DemoTester } from './components/DemoTester';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'heatmap' | 'demo'>('overview');

  // Stats & Backend Health
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Sessions
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortField, setSortField] = useState<string>('last_seen');

  // Selected Session Timeline Drawer
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionEventsData, setSessionEventsData] = useState<SessionEventsResponse | null>(null);
  const [loadingSessionEvents, setLoadingSessionEvents] = useState<boolean>(false);

  // Heatmap
  const [heatmapPages, setHeatmapPages] = useState<HeatmapPageItem[]>([]);
  const [selectedHeatmapUrl, setSelectedHeatmapUrl] = useState<string>('');
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);

  // ── Data Fetching Callbacks ───────────────────────────────────────────────
  const loadStatsAndHealth = useCallback(async () => {
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetchHealth().catch(() => ({ status: 'error', db: 'disconnected' })),
        fetchStats().catch(() => null),
      ]);
      setIsLive(healthRes.status === 'ok');
      if (statsRes) setStats(statsRes);
    } catch {
      setIsLive(false);
    }
  }, []);

  const loadSessions = useCallback(async (page = 1, sort = sortField) => {
    setLoadingSessions(true);
    try {
      const res = await fetchSessions({ page, limit: 15, sort, order: 'desc' });
      setSessions(res.sessions || []);
      setCurrentPage(res.pagination.page);
      setTotalPages(res.pagination.totalPages || 1);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [sortField]);

  const loadHeatmapPages = useCallback(async () => {
    try {
      const pages = await fetchHeatmapPages();
      setHeatmapPages(pages || []);
      if (pages && pages.length > 0 && !selectedHeatmapUrl) {
        setSelectedHeatmapUrl(pages[0].page_url);
      }
    } catch (err) {
      console.error('Failed to load heatmap pages:', err);
    }
  }, [selectedHeatmapUrl]);

  const loadHeatmap = useCallback(async (url: string) => {
    if (!url) return;
    setLoadingHeatmap(true);
    try {
      const data = await fetchHeatmap(url);
      setHeatmapData(data);
    } catch (err) {
      console.error('Failed to load heatmap points:', err);
    } finally {
      setLoadingHeatmap(false);
    }
  }, []);

  // Full Refresh
  const handleFullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      loadStatsAndHealth(),
      loadSessions(currentPage, sortField),
      loadHeatmapPages(),
      selectedHeatmapUrl ? loadHeatmap(selectedHeatmapUrl) : Promise.resolve(),
    ]);
    setIsRefreshing(false);
  }, [loadStatsAndHealth, loadSessions, currentPage, sortField, loadHeatmapPages, selectedHeatmapUrl, loadHeatmap]);

  // Initial Mount
  useEffect(() => {
    handleFullRefresh();
  }, []);

  // Auto-refresh interval (10s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadStatsAndHealth();
      if (activeTab === 'sessions') {
        loadSessions(currentPage, sortField);
      } else if (activeTab === 'heatmap' && selectedHeatmapUrl) {
        loadHeatmap(selectedHeatmapUrl);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, currentPage, sortField, selectedHeatmapUrl, loadStatsAndHealth, loadSessions, loadHeatmap]);

  // When selected heatmap page changes
  useEffect(() => {
    if (selectedHeatmapUrl) {
      loadHeatmap(selectedHeatmapUrl);
    }
  }, [selectedHeatmapUrl, loadHeatmap]);

  // Handle Session Click: open drawer and fetch events
  const handleSelectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLoadingSessionEvents(true);
    try {
      const res = await fetchSessionEvents(sessionId);
      setSessionEventsData(res);
    } catch (err) {
      console.error('Failed to fetch session events:', err);
    } finally {
      setLoadingSessionEvents(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedSessionId(null);
    setSessionEventsData(null);
  };

  return (
    <div className="dashboard-app">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLive={isLive}
        isRefreshing={isRefreshing}
        onRefresh={handleFullRefresh}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      <main className="dashboard-main">
        {/* Always display KPI cards at the top for immediate overview */}
        <section className="dashboard-section">
          <StatsCards stats={stats} loading={!stats} />
        </section>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <SessionList
              sessions={sessions}
              loading={loadingSessions}
              onSelectSession={handleSelectSession}
              selectedSessionId={selectedSessionId || undefined}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => loadSessions(page, sortField)}
              sortField={sortField}
              sortOrder="desc"
              onSortChange={(field) => {
                setSortField(field);
                loadSessions(1, field);
              }}
            />
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="tab-pane">
            <SessionList
              sessions={sessions}
              loading={loadingSessions}
              onSelectSession={handleSelectSession}
              selectedSessionId={selectedSessionId || undefined}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => loadSessions(page, sortField)}
              sortField={sortField}
              sortOrder="desc"
              onSortChange={(field) => {
                setSortField(field);
                loadSessions(1, field);
              }}
            />
          </div>
        )}

        {activeTab === 'heatmap' && (
          <div className="tab-pane">
            <HeatmapViewer
              pages={heatmapPages}
              selectedPageUrl={selectedHeatmapUrl}
              onSelectPage={setSelectedHeatmapUrl}
              heatmapData={heatmapData}
              loading={loadingHeatmap}
              onRefresh={() => loadHeatmap(selectedHeatmapUrl)}
            />
          </div>
        )}

        {activeTab === 'demo' && (
          <div className="tab-pane">
            <DemoTester onEventSent={handleFullRefresh} />
          </div>
        )}
      </main>

      {/* Session Details Drawer */}
      {selectedSessionId && (
        <SessionDetailDrawer
          sessionData={sessionEventsData}
          loading={loadingSessionEvents}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  );
}

export default App;
