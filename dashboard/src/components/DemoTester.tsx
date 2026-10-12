import React, { useState } from 'react';
import { Play, Send, ExternalLink, Code2, Check, Sparkles } from 'lucide-react';
import { sendTestEvent } from '../api';

interface DemoTesterProps {
  onEventSent: () => void;
}

export const DemoTester: React.FC<DemoTesterProps> = ({ onEventSent }) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const embedSnippet = `<script
  src="/tracker.js"
  data-endpoint="/api/events"
  async>
</script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendTestClick = async () => {
    setSending(true);
    setStatusMsg(null);
    try {
      const sessionId = 'live_test_' + Math.random().toString(36).substring(2, 8);
      await sendTestEvent({
        session_id: sessionId,
        type: 'click',
        page_url: 'http://localhost:4000/demo/index.html',
        page_title: 'Home — Demo Store',
        timestamp: new Date().toISOString(),
        x: Math.floor(Math.random() * 800) + 200,
        y: Math.floor(Math.random() * 500) + 150,
        target: {
          tag: 'button',
          id: 'test-cta-btn',
          classes: 'btn btn-primary',
          text: 'Interactive Test Click',
        },
      });
      setStatusMsg('Test click event ingested successfully!');
      onEventSent();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendTestPageView = async () => {
    setSending(true);
    setStatusMsg(null);
    try {
      const sessionId = 'live_test_' + Math.random().toString(36).substring(2, 8);
      await sendTestEvent({
        session_id: sessionId,
        type: 'page_view',
        page_url: 'http://localhost:4000/demo/product.html',
        page_title: 'Product — Demo Store',
        timestamp: new Date().toISOString(),
      });
      setStatusMsg('Test page_view event ingested successfully!');
      onEventSent();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="section-container glass">
      <div className="tester-grid">
        {/* Left Column: Quick Actions & Live Store */}
        <div className="tester-card">
          <div className="tester-card-header">
            <Play className="text-indigo" size={20} />
            <h3 className="tester-card-title">Live Demo Web Store</h3>
          </div>
          <p className="tester-card-desc">
            The demo store is pre-configured with the tracking script. Open pages, click on buttons and cards,
            and switch back to this dashboard to watch live sessions appear in real time!
          </p>

          <div className="demo-pages-links">
            <a
              href="/demo/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="demo-link-btn"
            >
              <span>Home Page</span>
              <ExternalLink size={14} />
            </a>
            <a
              href="/demo/product.html"
              target="_blank"
              rel="noopener noreferrer"
              className="demo-link-btn"
            >
              <span>Product Page</span>
              <ExternalLink size={14} />
            </a>
            <a
              href="/demo/pricing.html"
              target="_blank"
              rel="noopener noreferrer"
              className="demo-link-btn"
            >
              <span>Pricing Page</span>
              <ExternalLink size={14} />
            </a>
            <a
              href="/demo/contact.html"
              target="_blank"
              rel="noopener noreferrer"
              className="demo-link-btn"
            >
              <span>Contact Page</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="tester-divider" />

          <div className="tester-card-header">
            <Sparkles className="text-amber" size={20} />
            <h3 className="tester-card-title">Instant Ingestion Simulator</h3>
          </div>
          <p className="tester-card-desc">
            Directly post synthetic click or page_view telemetry packets to test the pipeline:
          </p>

          <div className="tester-action-btns">
            <button
              className="btn-primary"
              onClick={handleSendTestClick}
              disabled={sending}
            >
              <Send size={15} />
              <span>{sending ? 'Dispatching...' : 'Emit Random Click'}</span>
            </button>

            <button
              className="btn-secondary"
              onClick={handleSendTestPageView}
              disabled={sending}
            >
              <Send size={15} />
              <span>{sending ? 'Dispatching...' : 'Emit Page View'}</span>
            </button>
          </div>

          {statusMsg && (
            <div className={`status-banner ${statusMsg.startsWith('Error') ? 'banner-error' : 'banner-success'}`}>
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Right Column: Tracking Script Embed Instructions */}
        <div className="tester-card">
          <div className="tester-card-header">
            <Code2 className="text-cyan" size={20} />
            <h3 className="tester-card-title">Tracker Embed Snippet</h3>
          </div>
          <p className="tester-card-desc">
            To instrument any website with CausalFunnel Analytics, drop this single line into the HTML <code>&lt;head&gt;</code> or before <code>&lt;/body&gt;</code>:
          </p>

          <div className="code-block-wrap">
            <div className="code-block-header">
              <span className="mono">HTML</span>
              <button className="btn-copy-code" onClick={handleCopyCode}>
                {copiedCode ? <Check size={14} className="text-emerald" /> : <span>Copy Tag</span>}
              </button>
            </div>
            <pre className="code-pre mono">{embedSnippet}</pre>
          </div>

          <div className="features-list">
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Automatic Session UUID in localStorage + 30-day cookie fallback</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Zero external dependencies (&lt;3KB compressed)</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Captures X/Y coordinates, target elements, and viewport metrics</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Queue batching and guaranteed delivery with <code>navigator.sendBeacon</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
